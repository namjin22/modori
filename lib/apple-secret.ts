import { createPrivateKey, sign } from "node:crypto";

// Apple이 받아 주는 가장 긴 유효 기간이 6개월이다. 서버를 띄울 때마다 새로 만들므로(배포할 때마다) 넉넉히 150일로 둔다.
const LIFETIME_SECONDS = 150 * 24 * 60 * 60;

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/**
 * Apple 로그인의 client_secret. 고정된 문자열이 아니라 Apple 개발자 계정의 키(.p8)로 서명한 JWT(ES256)다.
 * https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret
 * 6개월마다 손으로 다시 만들어 넣지 않게, 키를 환경 변수로 받아 서버가 만든다.
 */
export function appleClientSecret({
  teamId,
  keyId,
  clientId,
  privateKey,
  now = Date.now(),
}: {
  teamId: string;
  keyId: string;
  // Services ID(웹 로그인용 식별자, 예: site.modori.web)
  clientId: string;
  // .p8 파일 내용. 환경 변수에 한 줄로 넣을 수 있게 "\n"으로 적은 줄바꿈도 받는다.
  privateKey: string;
  now?: number;
}): string {
  const issuedAt = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = base64url(
    JSON.stringify({
      iss: teamId,
      iat: issuedAt,
      exp: issuedAt + LIFETIME_SECONDS,
      aud: "https://appleid.apple.com",
      sub: clientId,
    }),
  );
  const key = createPrivateKey(privateKey.replace(/\\n/g, "\n"));
  // JWT의 ES256 서명은 DER이 아니라 r||s 64바이트다.
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${base64url(signature)}`;
}

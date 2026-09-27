import {
  PRIVACY_EFFECTIVE,
  PRIVACY_MANAGER,
  PRIVACY_SECTIONS,
} from "@/lib/privacy";

/** 개인정보처리방침 본문. /privacy 화면과 가입 동의 창이 같이 쓴다. */
export function PrivacyPolicy() {
  return (
    <div className="flex flex-col gap-5 text-sm leading-relaxed">
      <p className="text-muted">
        모도리는 할 일 기록과 친구 기능을 위해 꼭 필요한 정보만 모아요. 무엇을 모으고 어떻게
        쓰는지 알려드려요.
      </p>

      {PRIVACY_SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h3 className="font-semibold">{section.title}</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold">10. 개인정보 보호책임자</h3>
        <p className="text-muted">
          {PRIVACY_MANAGER.name} ·{" "}
          <a href={`mailto:${PRIVACY_MANAGER.email}`} className="text-brand underline">
            {PRIVACY_MANAGER.email}
          </a>
        </p>
      </section>

      <p className="text-xs text-muted">시행일: {PRIVACY_EFFECTIVE}</p>
    </div>
  );
}

import { PRIVACY_MANAGER } from "@/lib/privacy";
import { TERMS_EFFECTIVE, TERMS_SECTIONS } from "@/lib/terms";

/** 이용약관 본문. 모양은 개인정보처리방침(components/privacy-policy.tsx)과 맞춘다. */
export function TermsOfService() {
  return (
    <div className="flex flex-col gap-5 text-sm leading-relaxed">
      {TERMS_SECTIONS.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <h2 className="font-semibold">{section.title}</h2>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-muted">
            {section.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">8. 문의</h2>
        <p className="text-muted">
          운영자 {PRIVACY_MANAGER.name} ·{" "}
          <a href={`mailto:${PRIVACY_MANAGER.email}`} className="text-brand underline">
            {PRIVACY_MANAGER.email}
          </a>
        </p>
      </section>

      <p className="text-xs text-muted">시행일: {TERMS_EFFECTIVE}</p>
    </div>
  );
}

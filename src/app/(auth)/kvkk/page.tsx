"use client";

import Link from "next/link";
import { NetaSoftLogoFull } from "@/components/ui/NetaSoftLogo";
import { useLangContext } from "@/app/providers/LangProvider";

export default function KvkkPage() {
  const { lang } = useLangContext();
  const en = lang === "en";

  return (
    <div style={{ maxWidth: "760px", margin: "0 auto", padding: "var(--spacing-8) var(--spacing-5)" }}>
      <div style={{ marginBottom: "var(--spacing-6)" }}>
        <NetaSoftLogoFull size={40} />
      </div>

      <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "var(--spacing-2)" }}>
        {en ? "GDPR / Personal Data Protection Notice" : "KVKK Aydınlatma Metni"}
      </h1>
      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-sm)", marginBottom: "var(--spacing-6)" }}>
        {en ? "Personal Data Protection Law No. 6698 (\"KVKK\") Disclosure Text" : "6698 Sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") Kapsamında Aydınlatma Metni"}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-5)", fontSize: "var(--font-size-sm)", lineHeight: 1.8, color: "var(--color-text-secondary)" }}>
        <section>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--spacing-2)" }}>
            {en ? "1. Data Controller" : "1. Veri Sorumlusu"}
          </h2>
          <p>
            {en
              ? "NetaSoft (\"we\", \"the Platform\") acts as the data controller for the personal data you share while using our pharmacy financial management platform, in accordance with the Personal Data Protection Law No. 6698 (\"KVKK\")."
              : "NetaSoft (\"biz\", \"Platform\"), eczane finansal yönetim platformumuzu kullanırken paylaştığınız kişisel verilere ilişkin olarak 6698 sayılı Kişisel Verilerin Korunması Kanunu (\"KVKK\") uyarınca veri sorumlusu sıfatıyla hareket etmektedir."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--spacing-2)" }}>
            {en ? "2. Which Personal Data We Process" : "2. İşlenen Kişisel Veriler"}
          </h2>
          <p>
            {en
              ? "Identity information (pharmacist name), contact information (email address), account credentials, and the financial/operational data you enter or upload (register/cash entries, invoices, sales and inventory records) to operate the pharmacy's account within the platform."
              : "Kimlik bilgileri (eczacı adı soyadı), iletişim bilgileri (e-posta adresi), hesap kimlik bilgileri ve eczanenizin platform içerisindeki hesabının işletilmesi için girdiğiniz veya yüklediğiniz finansal/operasyonel veriler (kasa/gelir-gider kayıtları, faturalar, satış ve envanter kayıtları)."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--spacing-2)" }}>
            {en ? "3. Purpose of Processing" : "3. İşleme Amaçları"}
          </h2>
          <p>
            {en
              ? "Your personal data is processed to: create and manage your account, provide the platform's core features (financial reporting, sales/inventory analysis, AI-assisted insights), ensure account security (authentication, fraud prevention), and comply with our legal obligations."
              : "Kişisel verileriniz; hesabınızın oluşturulması ve yönetilmesi, platformun temel özelliklerinin (finansal raporlama, satış/envanter analizi, yapay zeka destekli içgörüler) sunulması, hesap güvenliğinin sağlanması (kimlik doğrulama, kötüye kullanımın önlenmesi) ve yasal yükümlülüklerimizin yerine getirilmesi amaçlarıyla işlenmektedir."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--spacing-2)" }}>
            {en ? "4. Legal Basis" : "4. Hukuki Sebep"}
          </h2>
          <p>
            {en
              ? "Personal data is processed on the basis of KVKK Art. 5/2, including: being necessary for the establishment/performance of a contract, compliance with a legal obligation, and our legitimate interest in operating and securing the platform, provided this does not harm your fundamental rights and freedoms."
              : "Kişisel verileriniz, KVKK m. 5/2 kapsamında; bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması, kanunlarda açıkça öngörülmesi ve temel hak ve özgürlüklerinize zarar vermemek kaydıyla veri sorumlusunun meşru menfaati için veri işlenmesinin zorunlu olması hukuki sebeplerine dayanılarak işlenmektedir."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--spacing-2)" }}>
            {en ? "5. Storage & Security" : "5. Saklama ve Güvenlik"}
          </h2>
          <p>
            {en
              ? "Your data is stored on secure servers for as long as your account is active and as required by applicable legal retention periods thereafter, and is protected with industry-standard technical and administrative measures (encryption in transit, hashed passwords, access controls)."
              : "Verileriniz, hesabınız aktif olduğu sürece ve sonrasında yasal saklama süreleri boyunca güvenli sunucularda saklanır; sektör standardı teknik ve idari tedbirlerle (aktarım sırasında şifreleme, özetlenmiş/hash'lenmiş şifreler, erişim kontrolleri) korunur."}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--font-size-lg)", fontWeight: 700, color: "var(--color-text-primary)", marginBottom: "var(--spacing-2)" }}>
            {en ? "6. Your Rights (KVKK Art. 11)" : "6. Haklarınız (KVKK m. 11)"}
          </h2>
          <p>
            {en
              ? "You have the right to learn whether your personal data is processed, request information about it, learn the purpose of processing, know third parties to whom it is transferred, request correction or deletion, and object to a result arising from automated analysis. You may exercise these rights by contacting us through the platform's settings page or your registered email."
              : "Kişisel verilerinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını öğrenme, yurt içinde/yurt dışında aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini isteme, silinmesini/yok edilmesini isteme ve otomatik sistemlerle analiz sonucu aleyhinize bir sonuç doğmasına itiraz etme haklarına sahipsiniz. Bu haklarınızı, platformun ayarlar sayfası veya kayıtlı e-posta adresiniz üzerinden bizimle iletişime geçerek kullanabilirsiniz."}
          </p>
        </section>

        <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-muted)", marginTop: "var(--spacing-4)" }}>
          {en
            ? "This is a standard-form disclosure template and does not constitute legal advice. Please review it with your legal counsel before relying on it for compliance purposes."
            : "Bu metin standart bir taslak niteliğindedir ve hukuki danışmanlık yerine geçmez. Uyum amaçlı kullanmadan önce hukuk danışmanınızla birlikte gözden geçirmenizi öneririz."}
        </p>
      </div>

      <div style={{ marginTop: "var(--spacing-8)" }}>
        <Link href="/kayit" className="auth-link">
          {en ? "← Back to Registration" : "← Kayıt Sayfasına Dön"}
        </Link>
      </div>
    </div>
  );
}

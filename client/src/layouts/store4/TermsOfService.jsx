import { useTranslation } from 'react-i18next';
import StaticPage from './StaticPage';

function EnglishBody() {
  return (
    <>
      <p className="s2-static-date">Last updated: May 2026</p>

      <section className="s2-static-section">
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing or using our website, by visiting our physical stores, or by placing an order with us, you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
      </section>

      <section className="s2-static-section">
        <h2>2. About Us</h2>
        <p>
          The website and the brand <strong>Anfal Sports</strong> are operated by <strong>Anfal Sports W.L.L.</strong>, with physical stores in Kuwait City. We sell athletic footwear, sportswear, fitness equipment and accessories to retail customers in Kuwait, both online and through our two physical stores.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>3. Products &amp; Pricing</h2>
        <ul>
          <li>All prices are listed in Kuwaiti Dinars (KWD) and are inclusive of taxes where applicable.</li>
          <li>Prices may change without prior notice. The price applicable to your order is the one shown at the time you place it.</li>
          <li>Product photography is illustrative; minor variation in colour and finish may occur between batches.</li>
          <li>We make every effort to display accurate stock, but errors may occasionally occur; we reserve the right to cancel and refund affected orders.</li>
          <li>Online stock reflects combined inventory across our two physical stores.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>4. Orders &amp; Payment</h2>
        <ul>
          <li>By placing an order, you confirm that the information you provide is accurate and complete.</li>
          <li>We may cancel or refuse any order at our discretion (e.g. pricing errors, stock issues, suspected fraud) and will refund any amount already paid.</li>
          <li>Online payments are processed securely via our payment gateway partners (such as Tap Payments). We do not see or store your full card or KNET credentials.</li>
          <li>In-store, we accept cash, KNET, and major cards via our terminal.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>5. Authenticity</h2>
        <p>
          All branded products sold by Anfal Sports are sourced through authorised channels and are 100% genuine. We do not deal in counterfeit, refurbished, or unauthorised parallel-imported goods.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>6. Returns &amp; Refunds</h2>
        <p>
          We offer 14-day returns on unused items in original packaging. Full details in our <a href="/return-policy">Return Policy</a> and <a href="/refund-policy">Refund Policy</a>.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>7. Manufacturer Warranty</h2>
        <p>
          Where the manufacturer offers a warranty (e.g. footwear sole separation, equipment defects), claims are handled per the manufacturer's terms. Bring the item and proof of purchase to either store and we will assist with the warranty process.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>8. User Accounts</h2>
        <p>
          You are responsible for keeping your login credentials confidential and for activity on your account. Please notify us at once if you suspect unauthorised access.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>9. Intellectual Property</h2>
        <p>All content on this website — including text, photography, logos, and design — is owned by Anfal Sports W.L.L. or its licensors. Reproduction, redistribution, or commercial use without our written permission is prohibited. Third-party brand names and logos remain the property of their respective owners.</p>
      </section>

      <section className="s2-static-section">
        <h2>10. Limitation of Liability</h2>
        <p>To the fullest extent permitted by Kuwaiti law, Anfal Sports W.L.L. shall not be liable for any indirect, incidental, or consequential loss arising from the use of our website or products. Our total liability for any direct loss is limited to the amount paid for the affected order.</p>
      </section>

      <section className="s2-static-section">
        <h2>11. Governing Law &amp; Jurisdiction</h2>
        <p>These terms are governed by the laws of the State of Kuwait. Any disputes arising out of or in connection with these terms or your use of our services shall be subject to the exclusive jurisdiction of the courts of Kuwait.</p>
      </section>

      <section className="s2-static-section">
        <h2>12. Changes to These Terms</h2>
        <p>We may update these terms from time to time. The latest version will always be available on this page with the date above. Continued use of our website or stores after changes constitutes acceptance.</p>
      </section>

      <section className="s2-static-section">
        <h2>13. Contact</h2>
        <p>For any questions regarding these terms or our services:</p>
        <p>
          <strong>Anfal Sports</strong> (Anfal Sports W.L.L.)<br />
          📍 Yaal Mall, Kuwait City<br />
          📧 <a href="mailto:info@anfalsports.com">info@anfalsports.com</a><br />
          📞 / WhatsApp: <a href="tel:+96500000000">+965 0000 0000</a>
        </p>
      </section>
    </>
  );
}

function ArabicBody() {
  return (
    <>
      <p className="s2-static-date">آخر تحديث: مايو 2026</p>

      <section className="s2-static-section">
        <h2>1. قبول الشروط</h2>
        <p>بدخولك إلى موقعنا أو استخدامه، أو زيارتك لمعارضنا الفعلية، أو إجرائك طلبًا لدينا، فإنك توافق على الالتزام بشروط الخدمة هذه. إذا لم توافق عليها، يُرجى عدم استخدام خدماتنا.</p>
      </section>

      <section className="s2-static-section">
        <h2>2. من نحن</h2>
        <p>
          هذا الموقع وعلامة <strong>أنفال سبورتس</strong> تديرهما <strong>شركة أنفال سبورتس ذ.م.م</strong>، ولها معارض فعلية في مدينة الكويت. نبيع أحذية ولوازم رياضية وملابس ومعدّات للياقة البدنية وإكسسوارات لعملاء التجزئة في الكويت، عبر الإنترنت ومن خلال معرضَينا الفعليَّين.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>3. المنتجات والأسعار</h2>
        <ul>
          <li>جميع الأسعار بالدينار الكويتي (KWD) وشاملة للضرائب حيثما انطبق.</li>
          <li>قد تتغيّر الأسعار دون إشعار مسبق. السعر المطبَّق على طلبك هو السعر المعروض وقت تقديمه.</li>
          <li>صور المنتجات للتوضيح؛ وقد يحدث اختلاف بسيط في اللون أو اللمسة النهائية بين الدفعات.</li>
          <li>نبذل قصارى جهدنا لعرض المخزون بدقّة، لكن قد تحدث أخطاء في بعض الأحيان؛ ونحتفظ بالحق في إلغاء الطلبات المتأثّرة واسترداد المبالغ.</li>
          <li>يعكس المخزون الإلكتروني المخزون المجمَّع لمعرضَينا الفعليَّين.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>4. الطلبات والدفع</h2>
        <ul>
          <li>بإتمامك أي طلب، فإنك تؤكّد أن المعلومات التي قدّمتها صحيحة وكاملة.</li>
          <li>يحقّ لنا إلغاء أو رفض أي طلب وفقًا لتقديرنا (مثل: أخطاء التسعير، مشكلات المخزون، الاشتباه بالاحتيال) وسنقوم باسترداد أي مبلغ مدفوع.</li>
          <li>تتمّ معالجة الدفع الإلكتروني بشكل آمن عبر شركاء بوابات الدفع لدينا (مثل Tap Payments). لا نطّلع على بيانات بطاقتك أو KNET الكاملة ولا نخزّنها.</li>
          <li>داخل المعرض، نقبل الدفع النقدي وKNET وأشهر البطاقات عبر جهاز نقاط البيع لدينا.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>5. الأصالة</h2>
        <p>
          جميع المنتجات الموسومة بعلامات تجارية والتي يبيعها أنفال سبورتس مصدرها قنوات معتمدة وأصلية 100%. لا نتعامل في منتجات مقلَّدة أو مُجدَّدة أو مستوردة بشكل غير رسمي.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>6. الإرجاع والاسترداد</h2>
        <p>
          نوفّر إمكانية الإرجاع خلال 14 يومًا للمنتجات غير المستعمَلة في تغليفها الأصلي. التفاصيل الكاملة في <a href="/ar/return-policy">سياسة الإرجاع</a> و<a href="/ar/refund-policy">سياسة استرداد المبالغ</a>.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>7. ضمان الشركة المصنّعة</h2>
        <p>
          عند وجود ضمان من الشركة المصنّعة (مثل انفصال نعل الحذاء، أو عيوب في المعدّات)، تُعالَج المطالبات وفق شروط الشركة المصنّعة. أحضِر المنتج وإثبات الشراء إلى أي من فروعنا وسنساعدك في إتمام إجراءات الضمان.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>8. حسابات المستخدمين</h2>
        <p>
          أنت مسؤول عن الحفاظ على سرّية بيانات تسجيل دخولك وعن جميع الأنشطة التي تتمّ عبر حسابك. يرجى إبلاغنا فورًا في حال الاشتباه بأي وصول غير مصرَّح به.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>9. الملكية الفكرية</h2>
        <p>جميع المحتويات على هذا الموقع — بما في ذلك النصوص والصور والشعارات والتصميم — مملوكة لشركة أنفال سبورتس ذ.م.م أو الجهات المُرخِّصة لها. يُحظَر النسخ أو إعادة التوزيع أو الاستخدام التجاري دون إذن خطّي منّا. تبقى أسماء وشعارات العلامات التجارية لأطراف ثالثة ملكًا لأصحابها.</p>
      </section>

      <section className="s2-static-section">
        <h2>10. تحديد المسؤولية</h2>
        <p>إلى أقصى حد يسمح به القانون الكويتي، لن تكون شركة أنفال سبورتس ذ.م.م مسؤولة عن أي خسائر غير مباشرة أو عرضية أو تبعية ناتجة عن استخدام موقعنا أو منتجاتنا. مسؤوليتنا الإجمالية عن أي خسارة مباشرة تقتصر على المبلغ المدفوع للطلب المتأثّر.</p>
      </section>

      <section className="s2-static-section">
        <h2>11. القانون الحاكم والاختصاص القضائي</h2>
        <p>تخضع هذه الشروط لقوانين دولة الكويت. وتخضع أي نزاعات تنشأ عن هذه الشروط أو تتعلق بها أو باستخدامك لخدماتنا للاختصاص القضائي الحصري لمحاكم دولة الكويت.</p>
      </section>

      <section className="s2-static-section">
        <h2>12. التعديلات على هذه الشروط</h2>
        <p>قد نقوم بتحديث هذه الشروط من وقت لآخر. ستكون أحدث نسخة متاحة دائمًا على هذه الصفحة مع التاريخ أعلاه. استمرارك في استخدام موقعنا أو معارضنا بعد التحديث يُعدّ موافقةً عليه.</p>
      </section>

      <section className="s2-static-section">
        <h2>13. التواصل</h2>
        <p>لأي استفسارات تتعلق بهذه الشروط أو خدماتنا:</p>
        <p>
          <strong>أنفال سبورتس</strong> (شركة أنفال سبورتس ذ.م.م)<br />
          📍 يال مول، مدينة الكويت<br />
          📧 <a href="mailto:info@anfalsports.com">info@anfalsports.com</a><br />
          📞 / واتساب: <a href="tel:+96500000000">+965 0000 0000</a>
        </p>
      </section>
    </>
  );
}

export default function TermsOfService() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  return (
    <StaticPage
      title="Terms of Service"
      titleAr="شروط الخدمة"
      description="Terms and conditions for using the Anfal Sports website, in-store services and physical stores in Kuwait."
      descriptionAr="الشروط والأحكام لاستخدام موقع أنفال سبورتس وخدماتنا في المعارض الفعلية في الكويت."
    >
      {isAr ? <ArabicBody /> : <EnglishBody />}
    </StaticPage>
  );
}

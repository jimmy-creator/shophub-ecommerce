import { useTranslation } from 'react-i18next';
import StaticPage from './StaticPage';

function EnglishBody() {
  return (
    <>
      <p className="s2-static-date">Last updated: May 2026</p>

      <section className="s2-static-section">
        <h2>14-Day Returns, No Hassle</h2>
        <p>
          You have <strong>14 days</strong> from the date of in-store purchase or delivery to return any unused item in original packaging for a refund or exchange. Tags on, box intact, shoes haven't walked outdoors.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>1. What We Accept</h2>
        <ul>
          <li>Footwear in original box, no scuffs or wear on the outsole.</li>
          <li>Apparel with all tags attached and in unworn condition.</li>
          <li>Equipment and accessories in original packaging and unused.</li>
          <li>Items must include any free gifts, manuals or warranty cards that came with them.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>2. What We Don't Accept</h2>
        <ul>
          <li>Worn shoes (we check the outsole).</li>
          <li>Used or opened socks, underwear, swimwear, mouthguards — hygiene items.</li>
          <li>Customised gear (printed names/numbers, custom-strung rackets, etc.).</li>
          <li>Sale or clearance items marked "Final Sale".</li>
          <li>Items past the 14-day window.</li>
          <li>Items damaged through use, mishandling or washing not per label.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. How to Return</h2>
        <ol>
          <li><strong>In-store</strong>: walk in to either branch with the item and your receipt or order number. Refund or exchange on the spot.</li>
          <li><strong>By courier</strong>: contact us by email or WhatsApp with your order number. We'll share return instructions. For change-of-mind returns the customer covers return shipping; for damaged or wrong items we cover it.</li>
          <li><strong>Inspection</strong>: items are inspected before the refund is processed. If something fails the check (e.g. clear wear) we'll be in touch to discuss next steps.</li>
        </ol>
      </section>

      <section className="s2-static-section">
        <h2>4. Exchanges</h2>
        <p>
          Wrong size? Wrong colour? Bring it back within 14 days for an exchange. Subject to stock availability at the branch you visit — if the size you want is at the other store, we can usually transfer it over within 1–2 days.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>5. Damaged or Defective on Arrival</h2>
        <p>
          Report within <strong>7 days of receipt</strong> with photos. We arrange free pickup and offer a replacement, repair (where the manufacturer's warranty applies), or refund.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>6. Refund Timeline & Method</h2>
        <p>
          Refunds processed within <strong>5–10 business days</strong> of receiving the return, credited to the original payment method. See our <a href="/refund-policy">Refund Policy</a> for the full breakdown.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>7. Contact</h2>
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
        <h2>إرجاع خلال 14 يومًا بدون متاعب</h2>
        <p>
          لديك <strong>14 يومًا</strong> من تاريخ الشراء من المعرض أو التسليم لإرجاع أي منتج غير مستعمَل في تغليفه الأصلي لاسترداد المبلغ أو الاستبدال. مع وجود البطاقات، وعدم تلف العلبة، وألا يكون الحذاء قد استُخدم خارج المنزل.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>1. ما نقبله</h2>
        <ul>
          <li>الأحذية في علبتها الأصلية، دون أي خدوش أو علامات استعمال على النعل الخارجي.</li>
          <li>الملابس بجميع بطاقاتها وبحالة لم تُرتدَ.</li>
          <li>المعدّات والإكسسوارات في تغليفها الأصلي وغير مستعمَلة.</li>
          <li>يجب أن يشمل المنتج أي هدايا مجانية أو كتيّبات أو بطاقات ضمان مرفقة به.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>2. ما لا نقبله</h2>
        <ul>
          <li>الأحذية المستعمَلة (نفحص النعل الخارجي).</li>
          <li>الجوارب وملابس الداخلية وملابس السباحة وواقيات الفم المستعمَلة أو المفتوحة — منتجات النظافة الشخصية.</li>
          <li>المنتجات المخصَّصة (طباعة أسماء/أرقام، مضارب مشدودة حسب الطلب، إلخ).</li>
          <li>منتجات التخفيضات أو التصفية الموسومة بـ "بيع نهائي".</li>
          <li>المنتجات المُرجَعة بعد انتهاء مهلة 14 يومًا.</li>
          <li>المنتجات التالفة بسبب الاستعمال أو سوء المعاملة أو الغسيل بشكل مخالف لتعليمات الملصق.</li>
        </ul>
      </section>

      <section className="s2-static-section">
        <h2>3. كيف تتمّ عملية الإرجاع</h2>
        <ol>
          <li><strong>من المعرض</strong>: توجَّه إلى أي من فروعنا مع المنتج وفاتورتك أو رقم طلبك. يتمّ استرداد المبلغ أو الاستبدال فورًا.</li>
          <li><strong>عن طريق الشحن</strong>: تواصل معنا بالبريد الإلكتروني أو واتساب مع رقم طلبك، وسنرسل لك تعليمات الإرجاع. في حالة الإرجاع بسبب تغيير الرأي يتحمّل العميل تكلفة الشحن العائد؛ أما في حالة المنتجات التالفة أو الخاطئة فنحن نتحمّلها.</li>
          <li><strong>الفحص</strong>: يتمّ فحص المنتجات قبل صرف الاسترداد. في حال لم يجتَز المنتج الفحص (مثلًا علامات استعمال واضحة)، سنتواصل معك لمناقشة الخيارات.</li>
        </ol>
      </section>

      <section className="s2-static-section">
        <h2>4. الاستبدال</h2>
        <p>
          مقاس خاطئ؟ لون خاطئ؟ أعِد المنتج خلال 14 يومًا لاستبداله. يخضع ذلك لتوفر المخزون في الفرع الذي تزوره — وإذا كان المقاس الذي تريده في الفرع الآخر، يمكننا عادةً نقله خلال 1–2 يوم عمل.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>5. التالف أو المعيب عند الاستلام</h2>
        <p>
          أبلِغنا خلال <strong>7 أيام من الاستلام</strong> مع الصور. سنرتّب استلامًا مجانيًا ونقدّم استبدالًا أو إصلاحًا (متى انطبق ضمان الشركة المصنّعة) أو استرداد المبلغ.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>6. مدة الاسترداد ووسيلة الدفع</h2>
        <p>
          تتم معالجة المبالغ المُسترَدة خلال <strong>5 إلى 10 أيام عمل</strong> من استلام المنتج المُرجَع، وتُعاد إلى وسيلة الدفع الأصلية. راجع <a href="/ar/refund-policy">سياسة استرداد المبالغ</a> للاطلاع على التفاصيل الكاملة.
        </p>
      </section>

      <section className="s2-static-section">
        <h2>7. التواصل</h2>
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

export default function ReturnPolicy() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  return (
    <StaticPage
      title="Return Policy"
      titleAr="سياسة الإرجاع"
      description="Anfal Sports return policy. 14-day returns on unused items in original packaging across our two stores and online."
      descriptionAr="سياسة الإرجاع لدى أنفال سبورتس. إرجاع خلال 14 يومًا للمنتجات غير المستعملة في تغليفها الأصلي في فرعَينا وعبر الإنترنت."
    >
      {isAr ? <ArabicBody /> : <EnglishBody />}
    </StaticPage>
  );
}

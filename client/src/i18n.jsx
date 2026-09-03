import React, { createContext, useContext, useEffect, useState } from 'react';

/**
 * Bilingual UI — English / Arabic.
 *
 * Deliberately translation-only: the layout stays left-to-right in both
 * languages. A full RTL mirror would flip the navigation, the charts and the
 * map controls, which is not what was asked for here — the requirement is that
 * the *words* switch, not that the interface reflows.
 *
 * Arabic numerals stay Western (٠-٩ are not used) because every figure on this
 * platform is a financial or operational metric that the same audience reads in
 * Latin digits elsewhere.
 */

const KEY = 'dld_lang';
const Ctx = createContext({ lang: 'en', t: (s) => s, toggle: () => {} });

/* Only UI chrome is translated — data from the CSVs (partner names, campaign
   titles) stays as recorded, which is how a bilingual government system
   actually behaves. */
const AR = {
  // ── Shell / nav
  'Command Center': 'مركز القيادة',
  'Digital Twin': 'التوأم الرقمي',
  'Intelligence': 'الذكاء الاصطناعي',
  'Operations': 'العمليات',
  'Partner Hub': 'بوابة الشركاء',
  'Executive Dashboard': 'لوحة القيادة التنفيذية',
  'Initiatives & Campaigns': 'المبادرات والحملات',
  'Sponsorships & Agreements': 'الرعايات والاتفاقيات',
  'Portfolio Map': 'خريطة المحفظة',
  'AI Copilot': 'المساعد الذكي',
  'What-If Simulator': 'محاكي السيناريوهات',
  'KPI Traceability': 'تتبع مؤشرات الأداء',
  'Approval Queue': 'قائمة الموافقات',
  'Events & Exhibitions': 'الفعاليات والمعارض',
  'Content & Assets': 'المحتوى والأصول',
  'My Activity': 'نشاطي',
  'Opportunity Marketplace': 'سوق الفرص',
  'Digital Assets Library': 'مكتبة الأصول الرقمية',
  'My Portfolio Map': 'خريطة محفظتي',
  'Dubai Land Department': 'دائرة الأراضي والأملاك',
  'Developer Connectivity': 'منصة ربط المطورين',

  // ── Header / chrome
  'AI ADVISORY': 'الاستشارة الذكية',
  'AI Advisory': 'الاستشارة الذكية',
  'Notifications': 'الإشعارات',
  'Communication Center': 'مركز الاتصالات',
  'Sign out': 'تسجيل الخروج',
  'Search partners, programmes, projects, agreements…': 'ابحث عن الشركاء والبرامج والمشاريع والاتفاقيات…',
  'Executive': 'تنفيذي',
  'Campaign Manager': 'مدير الحملات',
  'Administrator': 'مسؤول النظام',
  'Partner': 'شريك',
  'Mark all read': 'تعليم الكل كمقروء',
  'All': 'الكل',
  'Needs action': 'يتطلب إجراء',
  'Approvals': 'الموافقات',
  'Updates': 'التحديثات',
  'Unread': 'غير مقروء',
  'Open': 'فتح',
  'Searching…': 'جاري البحث…',
  'Powered by': 'مدعوم من',
  'Astrikos AI': 'أستريكوس للذكاء الاصطناعي',

  // ── Common labels
  'Registered Partners': 'الشركاء المسجلون',
  'Active Partners': 'الشركاء النشطون',
  'Avg. Approval Time': 'متوسط زمن الموافقة',
  'Digitally Completed': 'مكتمل رقمياً',
  'Active Campaigns': 'الحملات النشطة',
  'Total Campaign Reach': 'إجمالي الوصول',
  'Active Agreements': 'الاتفاقيات النشطة',
  'Blended Sponsorship ROI': 'العائد المدمج على الرعاية',
  'Partner Satisfaction': 'رضا الشركاء',
  'Portfolio Health': 'صحة المحفظة',
  'Adoption': 'التبني',
  'Efficiency': 'الكفاءة',
  'Commercial': 'التجاري',
  'Delivery': 'التنفيذ',
  'This week, generated': 'ملخص الأسبوع',
  'Needs a decision': 'يتطلب قراراً',
  'Ask the copilot': 'اسأل المساعد',
  'Partner Leaderboard': 'لوحة تصنيف الشركاء',
  'Programme Mix': 'مزيج البرامج',
  'days': 'يوم',
  'Strong': 'قوي',
  'Healthy': 'جيد',
  'Watch': 'مراقبة',
  'At risk': 'في خطر',

  // ── Actions
  'Launch New Initiative': 'إطلاق مبادرة جديدة',
  'Cancel': 'إلغاء',
  'Close': 'إغلاق',
  'Continue': 'متابعة',
  'Back': 'رجوع',
  'Approve': 'موافقة',
  'Reject': 'رفض',
  'Board': 'اللوحة',
  'Timeline': 'الجدول الزمني',
  'Table': 'الجدول',
  'Reset': 'إعادة تعيين',
  'Ask': 'اسأل',
  'Layers': 'الطبقات',
  'Overlays': 'التراكبات',
  'All time': 'كل الفترات',
  'Play': 'تشغيل',
  'Pause': 'إيقاف',
  'Loading…': 'جاري التحميل…',
  'Sign in': 'تسجيل الدخول',

  // ── Twin
  'Colour projects by': 'تلوين المشاريع حسب',
  'Engagement status': 'حالة المشاركة',
  'Engagement score': 'درجة المشاركة',
  'Sponsorship ROI': 'عائد الرعاية',
  'District outlines': 'حدود المناطق',
  'Campaign heatmap': 'خريطة حرارية للحملات',
  'Sponsorship density': 'كثافة الرعايات',
  'Mapped projects': 'المشاريع المعروضة',
  'Districts': 'المناطق',
  'Portfolio value': 'قيمة المحفظة',
  'Actively engaged': 'مشارك بنشاط',
  'Under construction': 'قيد الإنشاء',
  'Partnership timeline': 'الجدول الزمني للشراكات',
  '3D view': 'عرض ثلاثي الأبعاد',

  // ── AI / advisory
  'Generating advisory…': 'جاري إنشاء الاستشارة…',
  'Analysing platform records…': 'جاري تحليل بيانات المنصة…',
  'AI Advisory — generated from live data': 'استشارة ذكية — من البيانات الحية',
  'What this measures': 'ما الذي يقيسه',
  'Why it matters': 'أهميته',
  'Ask S!a': 'اسأل S!a',
  'How it is calculated': 'طريقة الحساب',
  'Key performance indicator': 'مؤشر الأداء الرئيسي',
  'Trend & breakdown': 'الاتجاه والتفصيل',
  'Target': 'المستهدف',
  'Interpreting your question…': 'جاري فهم سؤالك…',
  'Selecting the relevant records…': 'جاري اختيار السجلات ذات الصلة…',
  'Aggregating across the dataset…': 'جاري تجميع البيانات…',
  'Composing the answer…': 'جاري صياغة الإجابة…',
  'Querying records…': 'جاري الاستعلام…',
  'How can I help?': 'كيف يمكنني المساعدة؟',
  'Ask a question…': 'اطرح سؤالاً…',
  'Reading live platform data': 'يقرأ بيانات المنصة الحية',

  // ── Page titles and subtitles (header bar)
  'Executive Smart Dashboard': 'لوحة القيادة التنفيذية الذكية',
  'Adoption, efficiency and strategic impact across the partner ecosystem': 'التبني والكفاءة والأثر الاستراتيجي عبر منظومة الشركاء',
  'Partner Directory': 'دليل الشركاء',
  'The developer register — engagement, commercial standing and portfolio': 'سجل المطورين — المشاركة والوضع التجاري والمحفظة',
  'Engagement Analytics': 'تحليلات المشاركة',
  'Adoption, efficiency, satisfaction and request throughput': 'التبني والكفاءة والرضا ومعدل معالجة الطلبات',
  'Commercial Performance': 'الأداء التجاري',
  'Contracted value, delivery, collection and event return': 'القيمة التعاقدية والتنفيذ والتحصيل وعائد الفعاليات',
  'Joint Initiatives & Campaigns': 'المبادرات والحملات المشتركة',
  'Create, launch and monitor joint real estate programmes': 'إنشاء وإطلاق ومتابعة البرامج العقارية المشتركة',
  'Sponsorships & Agreements Ledger': 'سجل الرعايات والاتفاقيات',
  'Governance over financial and strategic commitments': 'حوكمة الالتزامات المالية والاستراتيجية',
  'Participation Approval Queue': 'قائمة الموافقة على المشاركات',
  'Review partner submissions and required documentation': 'مراجعة طلبات الشركاء والمستندات المطلوبة',
  'Content & Digital Assets Library': 'مكتبة المحتوى والأصول الرقمية',
  'Approved marketing materials and media assets': 'المواد التسويقية والإعلامية المعتمدة',
  'Digital Twin — Portfolio Map': 'التوأم الرقمي — خريطة المحفظة',
  'Live geospatial view of partner projects across the emirate': 'عرض جغرافي حي لمشاريع الشركاء في الإمارة',
  'Participation management and post-event impact reporting': 'إدارة المشاركة وتقارير الأثر بعد الفعالية',
  'AI Partnership Copilot': 'مساعد الشراكات الذكي',
  'Ask questions of the platform data in plain language': 'اطرح أسئلتك على بيانات المنصة بلغة بسيطة',
  'What-If Campaign Simulator': 'محاكي سيناريوهات الحملات',
  'Project programme outcomes before committing budget': 'توقع نتائج البرنامج قبل اعتماد الميزانية',
  'KPI Traceability Matrix': 'مصفوفة تتبع مؤشرات الأداء',
  'Every KPI in the brief, mapped to the screen that reports it': 'كل مؤشر أداء في الوثيقة مرتبط بالشاشة التي تعرضه',
  'Partner Activity': 'نشاط الشريك',
  'Your relationship with the Dubai Land Department at a glance': 'علاقتك مع دائرة الأراضي والأملاك في لمحة',
  'Upcoming partnership opportunities, campaigns and exhibitions': 'فرص الشراكة والحملات والمعارض القادمة',
  'My Agreements': 'اتفاقياتي',
  'Your sponsorship agreements, commitments and delivery standing': 'اتفاقيات الرعاية والالتزامات وحالة التنفيذ',
  'Register for exhibitions and track your participation': 'التسجيل في المعارض ومتابعة مشاركتك',
  'Your developments and their engagement status': 'مشاريعك وحالة مشاركتها',
  'Approved marketing and media materials available to you': 'المواد التسويقية والإعلامية المتاحة لك',
  'Developer Connectivity Platform': 'منصة ربط المطورين',

  // ── KPI labels
  'Mean Engagement Score': 'متوسط درجة المشاركة',
  'Mean Engagement': 'متوسط المشاركة',
  'Dormant Partners': 'الشركاء غير النشطين',
  'Open Requests': 'الطلبات المفتوحة',
  'Leads Delivered': 'العملاء المحتملون',
  'Engagement Rate': 'معدل المشاركة',
  'Event Footfall': 'زوار الفعاليات',
  'Event Media ROI': 'عائد التغطية الإعلامية',
  'Commitment Delivery': 'تنفيذ الالتزامات',
  'Invoice Collection': 'تحصيل الفواتير',
  'Agreements Flagged': 'اتفاقيات تحت المراجعة',
  'Mapped Portfolio Value': 'قيمة المحفظة المعروضة',
  'Delivery Pipeline': 'مشاريع قيد التنفيذ',
  'Mapped Projects': 'المشاريع المعروضة',
  'Actively Engaged': 'مشارك بنشاط',
  'Partners on the Map': 'الشركاء على الخريطة',
  'Contracted With Partners': 'المتعاقد عليه مع الشركاء',
  'Combined Portfolio': 'المحفظة المجمعة',
  'Partners Needing Attention': 'شركاء يتطلبون المتابعة',
  'Live Programmes': 'البرامج النشطة',
  'Pending Partner Requests': 'طلبات الشركاء المعلقة',
  'Committed Partner Value': 'القيمة الملتزم بها',
  'Cumulative Reach': 'الوصول التراكمي',
  'Partner Fill Rate': 'معدل إشغال الشركاء',
  'Programme Budget': 'ميزانية البرنامج',
  'Contracted Value': 'القيمة التعاقدية',
  'Blended ROI': 'العائد المدمج',
  'Flagged By Anomaly Rules': 'مرصود بقواعد الشذوذ',
  'Awaiting First Review': 'بانتظار المراجعة الأولى',
  'Under Review': 'قيد المراجعة',
  'Avg. Decision Time': 'متوسط زمن القرار',
  'Approved To Date': 'المعتمد حتى اليوم',
  'Incomplete Document Packs': 'مستندات غير مكتملة',
  'Submitted On-Platform': 'مقدم عبر المنصة',
  'Active Participations': 'المشاركات النشطة',
  'Requests In Flight': 'طلبات قيد المعالجة',
  'Leads Generated': 'العملاء المحتملون',
  'Media Mentions': 'الإشارات الإعلامية',
  'Active Sponsorships': 'الرعايات النشطة',
  'Engagement Score': 'درجة المشاركة',
  'Obligations Complete': 'الالتزامات المكتملة',
  'Registered Projects': 'المشاريع المسجلة',
  'Open Opportunities': 'الفرص المتاحة',
  'Approved Participations': 'المشاركات المعتمدة',
  'Closing Soon': 'تُغلق قريباً',
  'Best Match Score': 'أفضل درجة توافق',
  'Committed Value': 'القيمة الملتزم بها',
  'Commitments Delivered': 'الالتزامات المنفذة',
  'Invoiced To Date': 'المفوتر حتى اليوم',
  'Your Mean ROI': 'متوسط عائدك',
  'Needs Your Attention': 'يتطلب انتباهك',
  'Events Joined': 'الفعاليات المشارك بها',
  'Confirmed': 'مؤكد',
  'Leads Captured': 'العملاء المسجلون',
  'Awaiting Decision': 'بانتظار القرار',
  'Stand Investment': 'استثمار الجناح',
  'Meetings Held': 'الاجتماعات المنعقدة',
  'Assets Available': 'الأصول المتاحة',
  'Total Downloads': 'إجمالي التنزيلات',
  'Avg. Downloads Per Asset': 'متوسط التنزيلات لكل أصل',
  'Bilingual Assets': 'أصول ثنائية اللغة',
  'Restricted Assets': 'أصول مقيدة',
  'Most Downloaded': 'الأكثر تنزيلاً',
  'Events on calendar': 'الفعاليات المجدولة',
  'Total footfall': 'إجمالي الزوار',
  'Leads generated': 'العملاء المحتملون',
  'Media value returned': 'قيمة التغطية الإعلامية',
  'Media ROI': 'عائد التغطية الإعلامية',
  'Partner participations': 'مشاركات الشركاء',

  // ── Fragments used inside KPI footers
  'active': 'نشط',
  'of ecosystem': 'من المنظومة',
  'SLA compliance': 'الالتزام باتفاقية الخدمة',
  'completed to date': 'مكتمل حتى اليوم',
  'Avg. engagement': 'متوسط المشاركة',
  'Contracted': 'متعاقد عليه',
  'agreements flagged by AI': 'اتفاقيات رصدها الذكاء الاصطناعي',
  'outstanding': 'مستحق',
  'delivered': 'منفذ',
  'ahead': 'قادم',
  'Earned media': 'تغطية إعلامية مكتسبة',
  'projects': 'مشاريع',
  'districts': 'مناطق',
  'partners': 'شركاء',
  'requests': 'طلبات',
  'agreements': 'اتفاقيات',
  'media mentions': 'إشارات إعلامية',
  'registered partners': 'شريك مسجل',
  'Across': 'عبر',
  'No platform activity for 45 days or more': 'لا نشاط على المنصة منذ 45 يوماً أو أكثر',
  'Share of transactions handled fully on-platform': 'نسبة المعاملات المنجزة بالكامل عبر المنصة',
  'Rolling monthly partner survey': 'استبيان الشركاء الشهري',
  'Contracted deliverables actually met': 'المخرجات التعاقدية المنفذة فعلياً',
  'Tripping at least one anomaly rule': 'يخالف قاعدة رصد واحدة على الأقل',
  'Under construction across': 'قيد الإنشاء في',

  // ── Section and chart titles
  'Ecosystem Growth': 'نمو المنظومة',
  'Adoption by Developer Tier': 'التبني حسب فئة المطور',
  'Approval Time': 'زمن الموافقة',
  'Digital Completion': 'الإنجاز الرقمي',
  'Request Throughput': 'معدل معالجة الطلبات',
  'Engagement by Tier': 'المشاركة حسب الفئة',
  'Satisfaction Trend': 'اتجاه الرضا',
  'Contracted Value by Tier': 'القيمة التعاقدية حسب الفئة',
  'Return by Tier': 'العائد حسب الفئة',
  'Event Return Against Budget': 'عائد الفعاليات مقابل الميزانية',
  'Partner Grades': 'تصنيفات الشركاء',
  'Partner Register': 'سجل الشركاء',
  'Commitment delivery': 'تنفيذ الالتزامات',
  'Invoice collection': 'تحصيل الفواتير',
  'Delivered': 'منفذ',
  'Collected': 'محصّل',
  'Open the ledger': 'فتح السجل',
  'Everyone': 'الجميع',
  'Flagged only': 'المرصود فقط',
  'Dormant only': 'غير النشط فقط',
  'Cards': 'بطاقات',
  'Analytics': 'التحليلات',
  'At Risk': 'في خطر',
  'Under Construction': 'قيد الإنشاء',
  'Events & exhibitions': 'الفعاليات والمعارض',
  'At risk / flagged': 'في خطر / مرصود',
  'No live engagement': 'لا مشاركة نشطة',
  'Negative return': 'عائد سلبي',
  'Below target': 'دون المستهدف',
  'On target': 'ضمن المستهدف',
  'Exceptional': 'استثنائي',
  'Event venue': 'موقع الفعالية',
  'Community boundaries and names': 'حدود المجتمعات وأسماؤها',
  'Density of live campaign activity': 'كثافة نشاط الحملات الجارية',
  'Weighted by committed value': 'مرجّح بالقيمة الملتزم بها',
  'Venue locations on the calendar': 'مواقع الفعاليات في التقويم',
};

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem(KEY) || 'en');

  useEffect(() => {
    localStorage.setItem(KEY, lang);
    // The language is advertised for accessibility, but `dir` is deliberately
    // left as ltr — see the note at the top of this file.
    document.documentElement.setAttribute('lang', lang);
  }, [lang]);

  const t = (s) => (lang === 'ar' ? (AR[s] || s) : s);

  return (
    <Ctx.Provider value={{ lang, t, toggle: () => setLang((l) => (l === 'en' ? 'ar' : 'en')) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useI18n = () => useContext(Ctx);

/** EN / عربي switch, sitting beside the theme toggle in the header. */
export function LangToggle() {
  const { lang, toggle } = useI18n();
  return (
    <button className="icon-btn" onClick={toggle} title={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
      style={{ width: 'auto', padding: '0 10px', fontSize: 11.5, fontWeight: 750, letterSpacing: '0.02em' }}>
      {lang === 'en' ? 'ع' : 'EN'}
    </button>
  );
}

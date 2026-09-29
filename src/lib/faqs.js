// The FAQ page's questions, and the answers the client wrote.
//
// Plain data rather than JSX so two callers can share it: the FAQ page draws
// it, and the page's head (src/lib/seo-head.js) turns it into FAQPage
// structured data. Shipping and returns carry ids so the footer can link
// straight to them.
export const FAQS = [
  {
    q: "What makes Majestic Roobee fragrances different?",
    a: ["Majestic Roobee creates its own perfumes and fragrance products with a focus on safe products, quality and an elevated everyday fragrance experience."],
  },
  {
    q: "How do I choose a perfume?",
    a: ["Think about the fragrances you naturally enjoy. Do you prefer something floral, sweet, fresh, woody, warm or sensual? You can also consider when and where you plan to wear the fragrance.", "If you need recommendations on what to get, you can contact us on WhatsApp."],
    whatsapp: true,
  },
  {
    q: "How can I make my perfume last longer?",
    a: ["Apply perfume to moisturised skin. You can also layer complementary fragrance products."],
  },
  {
    q: "What is perfume oil?",
    a: ["Perfume oil is a concentrated fragrance designed to be applied directly to the skin and clothes. It usually sits closer to the skin than a traditional spray perfume."],
  },
  {
    q: "Can I layer my fragrances?",
    a: ["Yes. Layering allows you to combine complementary products and create a more personalised scent."],
  },
  {
    q: "How should I store my perfume?",
    a: ["Keep your perfume away from direct sunlight, excessive heat and humidity. A cool, dry place is ideal."],
  },
  {
    id: "shipping",
    q: "Do you deliver across Nigeria?",
    a: ["Yes, we deliver everywhere across Nigeria and outside Nigeria."],
  },
  {
    q: "How long does delivery take?",
    a: ["Priority delivery takes 1–2 days and standard shipping takes 3–5 business days.", "International shipping takes 3–12 working days."],
  },
  {
    id: "returns",
    q: "Do you accept returns or exchanges?",
    a: ["If you receive the wrong item or your products arrive faulty or damaged, please contact us as soon as possible so we can help resolve the issue. Terms and conditions apply."],
  },
];

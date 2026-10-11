export type SampleReview = { id: string; name: string; rating: 4 | 5; text: string; dish: string; isSample: true };

/** Placeholder reviews, always labelled "Sample reviews" in the UI. Dishes exist on the menu. */
export const sampleReviews: SampleReview[] = [
  { id: "sr1", name: "Priya", rating: 5, dish: "Nutella Pancakes", text: "Fluffy pancakes with a proper amount of Nutella. Perfect after a walk on the beach.", isSample: true },
  { id: "sr2", name: "Rahul", rating: 4, dish: "Flavoured Fries (Peri Peri Fries / Barbeque / Tandoori)", text: "Peri peri fries were crisp and nicely spiced. Good for sharing.", isSample: true },
  { id: "sr3", name: "Sneha", rating: 5, dish: "Mushroom Walnut Soup", text: "Warm, earthy and filling. Ordered a second bowl.", isSample: true },
  { id: "sr4", name: "Karthik", rating: 4, dish: "BBQ Potato Wedges", text: "Crunchy outside, soft inside, and the barbeque flavour works.", isSample: true },
  { id: "sr5", name: "Anjali", rating: 5, dish: "Spinach and Corn Omelette", text: "Light, fluffy and a good way to start the morning.", isSample: true },
  { id: "sr6", name: "Vikram", rating: 4, dish: "Creamy Broccoli Pizza", text: "Cheesy base with fresh broccoli. The kids finished it quickly.", isSample: true },
];

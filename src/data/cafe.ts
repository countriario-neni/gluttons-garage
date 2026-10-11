export type Cafe = {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  phoneE164: string;
  whatsapp: string;
  instagram: string;
  facebook: string | null;
  /** Delivery partner listings; shown on the public site only when set. */
  delivery: { swiggy: string | null; zomato: string | null };
  mapsUrl: string;
  mapsEmbed: string;
  /** Keyed by JS day: 0 = Sunday ... 6 = Saturday. */
  hours: Record<number, { open: string; close: string }>;
  amenities: string[];
  rating: { value: number; source: string };
};

const regular = { open: "08:00", close: "22:00" };

export const cafe: Cafe = {
  name: "Gluttons Garage",
  tagline: "Fusion Food • Speciality Coffees • Cool Beverages",
  address: "7-5-182, Dr NTR Beach Rd, beside Aqua Sports Complex, Pandurangapuram, Visakhapatnam 530003",
  phone: "+91 77023 68884",
  phoneE164: "+917702368884",
  whatsapp: "917702368884",
  instagram: "https://www.instagram.com/gluttons_garage/",
  facebook: null,
  delivery: { swiggy: null, zomato: null },
  mapsUrl: "https://maps.app.goo.gl/WDJRMVKBnvjigCqMA",
  mapsEmbed: "https://www.google.com/maps?q=Gluttons+Garage,+Beach+Road,+Pandurangapuram,+Visakhapatnam&output=embed",
  hours: {
    0: regular,
    1: { open: "08:00", close: "20:30" },
    2: regular,
    3: regular,
    4: regular,
    5: regular,
    6: regular,
  },
  amenities: ["Indoor & outdoor seating", "Kids' play area", "Book corner", "Party area", "Smoke zone"],
  rating: { value: 4.1, source: "Google" },
};

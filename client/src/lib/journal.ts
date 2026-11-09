/** The heatmap shade (1 to 4) for a day rated 1 to 10: darker is a better day. */
export const ratingShade = (rating: number) => (rating <= 3 ? 1 : rating <= 5 ? 2 : rating <= 7 ? 3 : 4);

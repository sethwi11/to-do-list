import { z } from 'zod';
import { daysBetween } from './dateTime';

// The morning quote: a local list (editable in Settings), one per day, no network.

export const QuoteSchema = z.object({ text: z.string().trim().min(1).max(300), by: z.string().trim().min(1).max(100) });
export type Quote = z.infer<typeof QuoteSchema>;

/** The same quote all day, a different one the next day, cycling through the list. */
export function quoteFor(date: string, quotes: readonly Quote[]): Quote | undefined {
  if (quotes.length === 0) return undefined;
  const n = daysBetween('2000-01-01', date);
  return quotes[((n % quotes.length) + quotes.length) % quotes.length];
}

export const DEFAULT_QUOTES: Quote[] = [
  { text: 'Simplicity is prerequisite for reliability.', by: 'Edsger W. Dijkstra' },
  { text: 'Talk is cheap. Show me the code.', by: 'Linus Torvalds' },
  { text: 'Programs must be written for people to read, and only incidentally for machines to execute.', by: 'Harold Abelson' },
  { text: 'The best way to predict the future is to invent it.', by: 'Alan Kay' },
  { text: 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', by: 'Martin Fowler' },
  { text: 'We can only see a short distance ahead, but we can see plenty there that needs to be done.', by: 'Alan Turing' },
  { text: 'If I have seen further it is by standing on the shoulders of giants.', by: 'Isaac Newton' },
  { text: 'The real problem is not whether machines think but whether men do.', by: 'B. F. Skinner' },
  { text: 'Well done is better than well said.', by: 'Benjamin Franklin' },
  { text: 'Lost time is never found again.', by: 'Benjamin Franklin' },
  { text: 'Excellence, then, is not an act but a habit.', by: 'Will Durant' },
  { text: 'Waste no more time arguing about what a good man should be. Be one.', by: 'Marcus Aurelius' },
  { text: 'What stands in the way becomes the way.', by: 'Marcus Aurelius' },
  { text: 'We suffer more often in imagination than in reality.', by: 'Seneca' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', by: 'Seneca' },
  { text: 'If there is no struggle, there is no progress.', by: 'Frederick Douglass' },
  { text: 'Success is to be measured not so much by the position that one has reached in life as by the obstacles which he has overcome.', by: 'Booker T. Washington' },
  { text: 'If you can’t fly then run, if you can’t run then walk, if you can’t walk then crawl, but whatever you do you have to keep moving forward.', by: 'Martin Luther King Jr.' },
  { text: 'The time is always right to do what is right.', by: 'Martin Luther King Jr.' },
  { text: 'The only way to do great work is to love what you do.', by: 'Steve Jobs' },
  { text: 'Your time is limited, so don’t waste it living someone else’s life.', by: 'Steve Jobs' },
  { text: 'Focusing is about saying no.', by: 'Steve Jobs' },
  { text: 'Plans are worthless, but planning is everything.', by: 'Dwight D. Eisenhower' },
  { text: 'Inspiration is for amateurs. The rest of us just show up and get to work.', by: 'Chuck Close' },
  { text: 'You miss 100% of the shots you don’t take.', by: 'Wayne Gretzky' },
  { text: 'Hard work beats talent when talent doesn’t work hard.', by: 'Tim Notke' },
  { text: 'Discipline equals freedom.', by: 'Jocko Willink' },
  { text: 'Someone’s sitting in the shade today because someone planted a tree a long time ago.', by: 'Warren Buffett' },
  { text: 'Rest is not idleness.', by: 'John Lubbock' },
  { text: 'I can do all things through Christ which strengtheneth me.', by: 'Philippians 4:13' },
  { text: 'Commit thy works unto the LORD, and thy thoughts shall be established.', by: 'Proverbs 16:3' },
  { text: 'Whatever you do, work heartily, as for the Lord and not for men.', by: 'Colossians 3:23' },
];

import { createEmptyCard, fsrs, generatorParameters, type Grade } from "ts-fsrs";

export class TsFsrsCalculator {
    readonly w: number[];
    readonly request_retention: number;
    readonly enable_short_term: boolean;
    readonly nDaysForRecallProjection: number;

    public constructor(w: number[], m: number[], enable_short_term: boolean, nDaysForRecallProjection: number) {
        this.w = w;
        this.request_retention = m[0];
        this.enable_short_term = enable_short_term;
        this.nDaysForRecallProjection = nDaysForRecallProjection;
    }

    calcDisplayDifficulty(d: number) {
        return (d - 1.0) / 9.0 * 100.0;
    }

    private calculateRecallProbabilityForNDays(stability: number): number {
        const t = this.nDaysForRecallProjection;
        const w20 = this.w[20]; // Assuming w[20] is the decay parameter for FSRS-6

        // FSRS-6 Retrievability Formula: R(t, S) = (1 + factor * t/S)^-w20
        // where factor = 0.9 / ((1/w20) - 1) to ensure R(S, S) = 90%.
        
        if (stability <= 0 || w20 <= 0 || t < 0) { // also check for non-negative t
            return 0;
        }
        const one_div_w20 = 1 / w20;
        if (one_div_w20 - 1 === 0) { // Avoid division by zero for factor
             return 0;
        }

        const factor = 0.9 / (one_div_w20 - 1);
        const recallProbability = Math.pow(1 + factor * t / stability, -w20);
        
        return Math.max(0, Math.min(1, recallProbability)); // Ensure probability is between 0 and 1
    }

    public steps(reviews: number[]): Card[] {
        let fsrs_card = createEmptyCard(new Date());
        const list = [];
        let cumulativeInterval = 0;
        const f = fsrs(generatorParameters({
            w: this.w,
            request_retention: this.request_retention,
            enable_short_term: this.enable_short_term
        }));

        for (const review of reviews) {
            const date = fsrs_card.due;
            fsrs_card = f.next(fsrs_card, date, review as Grade, (recordItem) => {
                const card = recordItem.card;
                const interval = f.next_interval(card.stability, card.elapsed_days);
                card.due = new Date(date.getTime() + interval * 24 * 60 * 60 * 1000);
                card.scheduled_days = interval;
                return card;
            });

            const displayDifficulty = this.calcDisplayDifficulty(fsrs_card.difficulty);
            const interval = fsrs_card.scheduled_days;
            cumulativeInterval += interval;
            const recallProbForN = this.calculateRecallProbabilityForNDays(fsrs_card.stability);
            list.push(new Card(fsrs_card.state, fsrs_card.difficulty, displayDifficulty, fsrs_card.stability, interval, cumulativeInterval, review, recallProbForN));
        }

        return list;
    }
}

export class Card {
    state: number;
    difficulty: number;
    displayDifficulty: number;
    stability: number;
    interval: number;
    cumulativeInterval: number;
    grade: number;
    recallProbabilityForNDays: number;

    public constructor(state: number, difficulty: number, displayDifficulty: number, stability: number, interval: number, cumulativeInterval: number, grade: number, recallProbabilityForNDays: number) {
        this.state = state;
        this.difficulty = difficulty;
        this.displayDifficulty = displayDifficulty;
        this.stability = stability;
        this.interval = interval;
        this.cumulativeInterval = cumulativeInterval;
        this.grade = grade;
        this.recallProbabilityForNDays = recallProbabilityForNDays;
    }
}

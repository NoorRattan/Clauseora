import { describe, it, expect } from 'vitest';
import { buildClaimTexts } from '@/lib/verification-claims';
describe('Comparison verification evidence', () => {
  it('checks each version against its own wording', () => {
    const map = buildClaimTexts({changes:[{topic:'Payment',changeType:'modified',before:'Pay $8,000 within 30 days.',after:'Pay $12,000 within 15 days.',whyReview:'Payment changed.',anchorIdsA:['A-1'],anchorIdsB:['B-1']}]}, 'compare');
    expect(map.get('A-1')).toBe('Pay $8,000 within 30 days.');
    expect(map.get('B-1')).toBe('Pay $12,000 within 15 days.');
  });
});

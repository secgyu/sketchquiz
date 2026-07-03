import { pickChoices, WORDS } from './words';

describe('제시어 뱅크', () => {
  it('뱅크에 중복 단어가 없다', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });

  it('pickChoices는 겹치지 않는 count개를 돌려준다', () => {
    const choices = pickChoices(3);
    expect(choices).toHaveLength(3);
    expect(new Set(choices).size).toBe(3); // 서로 다른 단어
    choices.forEach((w) => expect(WORDS).toContain(w));
  });

  it('요청 수가 뱅크보다 크면 있는 만큼만 돌려준다', () => {
    const choices = pickChoices(WORDS.length + 10);
    expect(choices).toHaveLength(WORDS.length);
    expect(new Set(choices).size).toBe(WORDS.length); // 중복 없이 전부
  });
});

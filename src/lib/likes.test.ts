import { describe, expect, it } from 'vitest';
import { addLike, cleanLikes, dropLike, likeChoices } from './likes';

describe('likes', () => {
  it('cleans typed lists', () => {
    expect(cleanLikes(['  Fitness ', '', 'fitness', 'Video  gaming', 3, null])).toEqual(['Fitness', 'Video gaming']);
    expect(cleanLikes(undefined)).toEqual([]);
    expect(cleanLikes('Fitness')).toEqual([]);
  });
  it('adds and drops ignoring capitals', () => {
    expect(addLike(['Pink'], 'pink')).toEqual(['Pink']);
    expect(addLike(['Pink'], ' Jazz ')).toEqual(['Pink', 'Jazz']);
    expect(addLike(['Pink'], '  ')).toEqual(['Pink']);
    expect(dropLike(['Pink', 'Jazz'], 'PINK')).toEqual(['Jazz']);
  });
  it('builds one shared list for likes and dislikes, counting Sims once', () => {
    const sims = [
      { likes: ['Fitness', 'Country music'], dislikes: [] },
      { likes: ['fitness'], dislikes: ['Country music'], turnOns: ['Funny'] },
      { dislikes: ['Cooking', 'cooking'] },
    ];
    expect(likeChoices(sims, 'likes')).toEqual([
      { label: 'Cooking', sims: 1 }, { label: 'Country music', sims: 2 }, { label: 'Fitness', sims: 2 },
    ]);
    expect(likeChoices(sims, 'dislikes')).toEqual(likeChoices(sims, 'likes'));
    expect(likeChoices(sims, 'turnOffs')).toEqual([{ label: 'Funny', sims: 1 }]);
  });
});

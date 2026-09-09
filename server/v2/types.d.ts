declare module "snowball-stemmers" {
  export function newStemmer(lang: string): { stem(word: string): string };
  const _default: { newStemmer: typeof newStemmer };
  export default _default;
}

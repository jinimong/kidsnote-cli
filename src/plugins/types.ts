// biome-ignore lint/suspicious/noExplicitAny: 플러그인 provider 함수는 다양한 시그니처를 가질 수 있음
export type ProviderFn = (...args: any[]) => any;

export interface KidsnotePlugin {
  name: string;
  version: string;
  providers?: Record<string, ProviderFn>;
}

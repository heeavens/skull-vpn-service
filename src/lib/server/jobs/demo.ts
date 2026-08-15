export type DemoJobEffect = () => Promise<void>;

export async function runDemoJob(effect: DemoJobEffect): Promise<void> {
  await effect();
}

import YourSkyShell from "@/components/your-sky/YourSkyShell";
import TonightView from "@/components/your-sky/TonightView";

export default function Home() {
  return (
    <YourSkyShell active="tonight">
      <TonightView />
    </YourSkyShell>
  );
}

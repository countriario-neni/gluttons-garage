import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="reveal text-5xl font-bold text-primary">Gluttons Garage</h1>
      <p className="text-muted-foreground">Fusion happens here.</p>
      <Button size="lg">Order now</Button>
    </main>
  );
}

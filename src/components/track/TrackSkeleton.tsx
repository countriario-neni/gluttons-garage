import { Container } from "@/components/site/primitives/Container";
import { Skeleton } from "@/components/ui/skeleton";

export function TrackSkeleton() {
  return (
    <Container className="max-w-5xl py-8 sm:py-12" >
      <div role="status" aria-label="Loading your order" className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-28 rounded-3xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </div>
    </Container>
  );
}

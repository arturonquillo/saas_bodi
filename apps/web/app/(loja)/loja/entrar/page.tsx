import { Suspense } from "react";
import { EntrarScreen } from "@/ui/store/EntrarScreen";
import { FormSkeleton } from "@/ui/states";
import { AuthStage } from "@/ui/layout";

export default function Page() {
  return (
    <Suspense
      fallback={
        <AuthStage>
          <FormSkeleton />
        </AuthStage>
      }
    >
      <EntrarScreen />
    </Suspense>
  );
}

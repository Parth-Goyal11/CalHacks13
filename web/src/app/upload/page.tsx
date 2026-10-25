import { Suspense } from "react";
import CaptureExperience from "@/components/your-sky/CaptureExperience";

export default function UploadPage() {
  return (
    <Suspense fallback={null}>
      <CaptureExperience />
    </Suspense>
  );
}

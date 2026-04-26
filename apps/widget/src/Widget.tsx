import { useState } from "react";

import { DocumentStep } from "./steps/DocumentStep";
import { FormStep } from "./steps/FormStep";
import { LivenessStep } from "./steps/LivenessStep";
import { SuccessStep } from "./steps/SuccessStep";

type Step = "form" | "document" | "liveness" | "success";

type WidgetProps = {
  workflowsApiUrl: string;
  workspaceId: string;
  customerId: string;
  onComplete?: (status: "submitted") => void;
};

export const Widget = (props: WidgetProps) => {
  const { workflowsApiUrl, workspaceId, customerId, onComplete } = props;
  const [step, setStep] = useState<Step>("form");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const STEPS: Step[] = ["form", "document", "liveness", "success"];
  const stepIndex = STEPS.indexOf(step);

  const stepLabels = ["Personal Info", "Documents", "Liveness Check", "Done"];

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-lg">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-md bg-primary-200 flex items-center justify-center">
            <span className="text-xs font-bold text-primary-700">UC</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">
            UserCore Verification
          </span>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1.5 ${i <= stepIndex ? "text-primary-700" : "text-gray-400"}`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium border ${
                    i < stepIndex
                      ? "bg-primary-200 border-primary-200 text-primary-800"
                      : i === stepIndex
                        ? "border-primary-400 text-primary-700"
                        : "border-gray-200 text-gray-400"
                  }`}
                >
                  {i < stepIndex ? "✓" : i + 1}
                </div>
                <span className="text-xs hidden sm:inline">{label}</span>
              </div>
              {i < stepLabels.length - 1 && (
                <div
                  className={`flex-1 h-px w-4 ${i < stepIndex ? "bg-primary-300" : "bg-gray-200"}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="px-8 py-6">
        {step === "form" && (
          <FormStep
            workflowsApiUrl={workflowsApiUrl}
            workspaceId={workspaceId}
            customerId={customerId}
            onComplete={(id) => {
              setSessionId(id);
              setStep("document");
            }}
          />
        )}
        {step === "document" && sessionId && (
          <DocumentStep
            workflowsApiUrl={workflowsApiUrl}
            sessionId={sessionId}
            onComplete={() => setStep("liveness")}
          />
        )}
        {step === "liveness" && sessionId && (
          <LivenessStep
            workflowsApiUrl={workflowsApiUrl}
            sessionId={sessionId}
            onComplete={() => {
              setStep("success");
              onComplete?.("submitted");
            }}
          />
        )}
        {step === "success" && <SuccessStep />}
      </div>
    </div>
  );
};

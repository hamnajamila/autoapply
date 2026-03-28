"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ResumeUploadStep({
  onFile,
  canContinue,
  onContinue,
  loading
}: {
  onFile: (file: File) => void;
  canContinue: boolean;
  onContinue: () => void;
  loading: boolean;
}) {
  return (
    <Card className="border-white/10 bg-white/5">
      <CardHeader>
        <CardTitle>Step 1 - Upload your resume</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="file"
          accept=".pdf,.docx"
          className="border-white/10 bg-white/5"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              onFile(file);
            }
          }}
        />
        {loading ? <div className="text-sm text-white/70">Parsing your resume with AI...</div> : null}
        <div className="flex justify-end">
          <Button className="bg-[#6366f1] hover:bg-[#5558e6]" disabled={!canContinue} onClick={onContinue}>
            Looks good, next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

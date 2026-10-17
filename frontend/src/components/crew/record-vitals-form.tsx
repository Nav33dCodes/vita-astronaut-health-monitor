"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useRecordVitals } from "@/lib/api/queries";
import type { Alert, VitalReading } from "@/lib/api/types";
import { applyServerErrors } from "@/lib/hooks";

// Mirrors the API's RecordVitalsRequestValidator: rejects sensor faults, not unhealthy values.
const schema = z
  .object({
    heartRateBpm: z.number({ error: "Required" }).int().min(20).max(250),
    systolicMmHg: z.number({ error: "Required" }).int().min(50).max(260),
    diastolicMmHg: z.number({ error: "Required" }).int().min(30).max(160),
    oxygenSaturationPct: z.number({ error: "Required" }).min(50).max(100),
    bodyTemperatureC: z.number({ error: "Required" }).min(30).max(45),
    respiratoryRatePerMin: z.number({ error: "Required" }).int().min(4).max(60),
    radiationDoseMsv: z.number({ error: "Required" }).min(0).max(1000),
    notes: z.string().max(500),
  })
  .refine((v) => v.diastolicMmHg < v.systolicMmHg, {
    path: ["diastolicMmHg"],
    message: "Must be lower than systolic",
  });

type FormValues = z.infer<typeof schema>;

const FIELDS: { name: Exclude<keyof FormValues, "notes">; label: string; step: string }[] = [
  { name: "heartRateBpm", label: "Heart rate (bpm)", step: "1" },
  { name: "oxygenSaturationPct", label: "SpO₂ (%)", step: "0.1" },
  { name: "systolicMmHg", label: "Systolic (mmHg)", step: "1" },
  { name: "diastolicMmHg", label: "Diastolic (mmHg)", step: "1" },
  { name: "bodyTemperatureC", label: "Temperature (°C)", step: "0.1" },
  { name: "respiratoryRatePerMin", label: "Respiration (/min)", step: "1" },
  { name: "radiationDoseMsv", label: "Radiation dose (mSv)", step: "0.001" },
];

interface Props {
  astronautId: string;
  previous: VitalReading | null;
  onRecorded: (raised: Alert[]) => void;
  onCancel: () => void;
}

export function RecordVitalsForm({ astronautId, previous, onRecorded, onCancel }: Props) {
  const record = useRecordVitals(astronautId);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // Pre-fill with the last reading so medics only adjust what changed.
    defaultValues: {
      heartRateBpm: previous?.heartRateBpm ?? 72,
      systolicMmHg: previous?.systolicMmHg ?? 118,
      diastolicMmHg: previous?.diastolicMmHg ?? 76,
      oxygenSaturationPct: previous?.oxygenSaturationPct ?? 98,
      bodyTemperatureC: previous?.bodyTemperatureC ?? 36.8,
      respiratoryRatePerMin: previous?.respiratoryRatePerMin ?? 14,
      radiationDoseMsv: previous?.radiationDoseMsv ?? 0.2,
      notes: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    record.mutate(
      { ...values, notes: values.notes || null },
      {
        onSuccess: (response) => onRecorded(response.raisedAlerts),
        onError: (error) => setFormError(applyServerErrors(error, setError)),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(({ name, label, step }) => (
          <Field key={name} label={label} error={errors[name]?.message}>
            <Input
              type="number"
              step={step}
              inputMode="decimal"
              aria-invalid={!!errors[name]}
              {...register(name, { valueAsNumber: true })}
            />
          </Field>
        ))}
      </div>
      <Field label="Notes" error={errors.notes?.message}>
        <Input {...register("notes")} placeholder="Context, symptoms, activity…" />
      </Field>
      {formError && <p role="alert" className="text-sm text-critical">{formError}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={record.isPending}>
          Record reading
        </Button>
      </div>
    </form>
  );
}

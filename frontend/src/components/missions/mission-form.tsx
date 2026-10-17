"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useCreateMission } from "@/lib/api/queries";
import type { Mission, MissionDestination } from "@/lib/api/types";
import { DESTINATION_LABELS } from "@/lib/format";
import { applyServerErrors } from "@/lib/hooks";

const DESTINATIONS = Object.keys(DESTINATION_LABELS) as [MissionDestination, ...MissionDestination[]];

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  destination: z.enum(DESTINATIONS),
  launchDate: z.string().min(1, "Launch date is required"),
  description: z.string().max(1000),
});

type FormValues = z.infer<typeof schema>;

export function MissionForm({ onDone }: { onDone: (created?: Mission) => void }) {
  const create = useCreateMission();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", destination: "Lunar", launchDate: "", description: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    create.mutate(
      { ...values, description: values.description || null },
      { onSuccess: (created) => onDone(created), onError: (error) => setFormError(applyServerErrors(error, setError)) },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Mission name" error={errors.name?.message}>
        <Input {...register("name")} aria-invalid={!!errors.name} autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Destination" error={errors.destination?.message}>
          <Select {...register("destination")}>
            {DESTINATIONS.map((d) => (
              <option key={d} value={d}>
                {DESTINATION_LABELS[d]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Launch date" error={errors.launchDate?.message}>
          <Input type="date" {...register("launchDate")} aria-invalid={!!errors.launchDate} />
        </Field>
      </div>
      <Field label="Description" error={errors.description?.message}>
        <Input {...register("description")} />
      </Field>
      {formError && <p role="alert" className="text-sm text-critical">{formError}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          Create mission
        </Button>
      </div>
    </form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useCreateAstronaut, useMissions } from "@/lib/api/queries";
import type { AstronautDetail, CrewRole } from "@/lib/api/types";
import { ROLE_OPTIONS, humanize } from "@/lib/format";
import { applyServerErrors } from "@/lib/hooks";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  agency: z.string().trim().min(1, "Agency is required").max(60),
  role: z.enum(ROLE_OPTIONS as [CrewRole, ...CrewRole[]]),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  missionId: z.string(),
});

type FormValues = z.infer<typeof schema>;

export function AstronautForm({ onDone }: { onDone: (created?: AstronautDetail) => void }) {
  const missions = useMissions();
  const create = useCreateAstronaut();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", agency: "NASA", role: "MissionSpecialist", dateOfBirth: "", missionId: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    create.mutate(
      { ...values, missionId: values.missionId || null },
      { onSuccess: (created) => onDone(created), onError: (error) => setFormError(applyServerErrors(error, setError)) },
    );
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={errors.firstName?.message}>
          <Input {...register("firstName")} aria-invalid={!!errors.firstName} autoFocus />
        </Field>
        <Field label="Last name" error={errors.lastName?.message}>
          <Input {...register("lastName")} aria-invalid={!!errors.lastName} />
        </Field>
        <Field label="Agency" error={errors.agency?.message}>
          <Input {...register("agency")} aria-invalid={!!errors.agency} />
        </Field>
        <Field label="Role" error={errors.role?.message}>
          <Select {...register("role")}>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {humanize(role)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date of birth" error={errors.dateOfBirth?.message}>
          <Input type="date" {...register("dateOfBirth")} aria-invalid={!!errors.dateOfBirth} />
        </Field>
        <Field label="Mission" error={errors.missionId?.message}>
          <Select {...register("missionId")}>
            <option value="">Unassigned</option>
            {missions.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {formError && <p role="alert" className="text-sm text-critical">{formError}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" loading={create.isPending}>
          Add astronaut
        </Button>
      </div>
    </form>
  );
}

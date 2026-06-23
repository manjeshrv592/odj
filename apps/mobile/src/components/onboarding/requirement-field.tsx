import * as React from "react";
import type { RequirementField } from "@odj/shared";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { ImageField } from "./image-field";

type AnswerValue = string | string[] | undefined;

/**
 * Renders one admin-defined requirement field by its `inputType`:
 * `text` → Input, `select` → Select (its options), `file` → image upload. The
 * answer is reported back to the wizard, which stores it keyed by the field's
 * stable `key`. `required` is reflected in the label; completeness is enforced
 * server-side at submit.
 */
export function RequirementFieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: RequirementField;
  value: AnswerValue;
  onChange: (value: string | null) => void;
  error?: string | null;
}) {
  if (field.inputType === "select") {
    const options = (field.options ?? []).map((o) => ({
      value: o.value,
      label: o.label,
    }));
    return (
      <Field label={field.label} required={field.required} error={error}>
        <Select
          value={typeof value === "string" ? value : null}
          options={options}
          onChange={onChange}
        />
      </Field>
    );
  }

  if (field.inputType === "file") {
    const hint = field.allowedFileTypes?.length
      ? `Allowed: ${field.allowedFileTypes.join(", ")}`
      : undefined;
    return (
      <Field label={field.label} required={field.required} hint={hint} error={error}>
        <ImageField
          shape="square"
          value={typeof value === "string" ? value : null}
          onChange={onChange}
        />
      </Field>
    );
  }

  // text
  return (
    <Field label={field.label} required={field.required} error={error}>
      <Input
        value={typeof value === "string" ? value : ""}
        onChangeText={onChange}
        placeholder="Type your answer"
      />
    </Field>
  );
}

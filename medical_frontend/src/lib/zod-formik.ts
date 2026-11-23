import type { ZodType } from 'zod';

/**
 * Wires a Zod schema into Formik's `validate` prop, so every form keeps Zod as
 * its single validation source of truth instead of picking up Yup (Formik's
 * default pairing) as a second schema language. Formik's `validate` wants a
 * plain `{ field: message }` map — Zod's `flatten().fieldErrors` gives
 * `{ field: string[] }`, so this takes the first message per field.
 *
 * Two type params matter when a schema coerces (`z.coerce.number()` etc): the
 * form's live `values` are always whatever the DOM gives Formik (strings), but
 * the schema's inferred `Output` type is post-coercion. Pass both explicitly
 * for a coercing schema, e.g. `zodValidate<FormValues, FormInput>(schema)`.
 */
export function zodValidate<Output, Input = Output>(schema: ZodType<Output>) {
  return (values: Input): Record<string, string> => {
    const result = schema.safeParse(values);
    if (result.success) return {};
    const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    return Object.fromEntries(
      Object.entries(fieldErrors)
        .filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
        .map(([field, messages]) => [field, messages[0]]),
    );
  };
}

/**
 * Express middleware factory for query parameter validation.
 *
 * @param {Record<string, { type: 'string'|'number'|'enum', required?: boolean, values?: string[] }>} schema
 * @returns {import('express').RequestHandler}
 */
export function validateQuery(schema) {
  if (schema == null || typeof schema !== "object") {
    throw new Error("schema must be a non-null object");
  }

  return (req, res, next) => {
    const validated = {};
    const errors = [];

    for (const [param, rule] of Object.entries(schema)) {
      const raw = req.query[param];

      if (raw == null || raw === "") {
        if (rule.required) {
          errors.push(`Missing required query parameter: ${param}`);
        }
        continue;
      }

      const result = coerceAndValidate(param, raw, rule);

      if (result.error) {
        errors.push(result.error);
      } else {
        validated[param] = result.value;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: errors.join("; "),
        data: null,
      });
    }

    req.validatedQuery = validated;
    next();
  };
}

function coerceAndValidate(param, raw, rule) {
  switch (rule.type) {
    case "string": {
      return { value: String(raw) };
    }

    case "number": {
      const num = Number(raw);
      if (Number.isNaN(num)) {
        return {
          error: `Query parameter '${param}' must be a valid number, got '${raw}'`,
        };
      }
      return { value: num };
    }

    case "enum": {
      const values = rule.values ?? [];
      if (!values.includes(raw)) {
        return {
          error: `Query parameter '${param}' must be one of [${values.join(", ")}], got '${raw}'`,
        };
      }
      return { value: raw };
    }

    default: {
      return { error: `Unknown validation type '${rule.type}' for param '${param}'` };
    }
  }
}

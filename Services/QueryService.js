function normalizeOperator(operator) {
  return String(operator || "").trim().toLowerCase();
}

function getFieldValue(item, field) {
  if (!field || typeof field !== "string") {
    return undefined;
  }

  if (field in item) {
    return item[field];
  }

  return item.meta ? item.meta[field] : undefined;
}

function toComparable(value) {
  if (value == null) {
    return value;
  }

  if (typeof value === "number") {
    return value;
  }

  const maybeNumber = Number(value);
  if (!Number.isNaN(maybeNumber) && String(value).trim() !== "") {
    return maybeNumber;
  }

  return String(value).toLowerCase();
}

function evaluateCondition(item, token) {
  const fieldValue = getFieldValue(item, token.field);
  const operator = normalizeOperator(token.operator);
  const compareValue = token.value;

  const left = fieldValue;
  const right = compareValue;

  switch (operator) {
    case "eq":
    case "equals":
    case "=": {
      return String(left ?? "").toLowerCase() === String(right ?? "").toLowerCase();
    }
    case "in": {
      if (Array.isArray(left)) {
        return left.some((entry) => String(entry).toLowerCase() === String(right ?? "").toLowerCase());
      }
      return String(left ?? "").toLowerCase().includes(String(right ?? "").toLowerCase());
    }
    case "contains": {
      return String(left ?? "").toLowerCase().includes(String(right ?? "").toLowerCase());
    }
    case "startswith": {
      return String(left ?? "").toLowerCase().startsWith(String(right ?? "").toLowerCase());
    }
    case "endswith": {
      return String(left ?? "").toLowerCase().endsWith(String(right ?? "").toLowerCase());
    }
    case "gt":
    case ">": {
      return toComparable(left) > toComparable(right);
    }
    case "gte":
    case ">=": {
      return toComparable(left) >= toComparable(right);
    }
    case "lt":
    case "<": {
      return toComparable(left) < toComparable(right);
    }
    case "lte":
    case "<=": {
      return toComparable(left) <= toComparable(right);
    }
    default:
      throw new Error(`unsupported filter operator: ${token.operator}`);
  }
}

function toRpn(filterTokens) {
  const output = [];
  const ops = [];
  const precedence = {
    and: 2,
    or: 1
  };

  for (const token of filterTokens) {
    const op = normalizeOperator(token?.operator);

    if (op === "openbracket") {
      ops.push("(");
      continue;
    }

    if (op === "closebracket") {
      while (ops.length > 0 && ops[ops.length - 1] !== "(") {
        output.push({ type: "logic", operator: ops.pop() });
      }
      if (ops.length === 0 || ops[ops.length - 1] !== "(") {
        throw new Error("filter syntax error: unbalanced brackets");
      }
      ops.pop();
      continue;
    }

    if (op === "and" || op === "or") {
      while (
        ops.length > 0 &&
        ops[ops.length - 1] !== "(" &&
        precedence[ops[ops.length - 1]] >= precedence[op]
      ) {
        output.push({ type: "logic", operator: ops.pop() });
      }
      ops.push(op);
      continue;
    }

    if (!token.field) {
      throw new Error("filter syntax error: missing field on condition");
    }

    output.push({ type: "condition", token });
  }

  while (ops.length > 0) {
    const operator = ops.pop();
    if (operator === "(") {
      throw new Error("filter syntax error: unbalanced brackets");
    }
    output.push({ type: "logic", operator });
  }

  return output;
}

function evaluateRpn(item, rpn) {
  const stack = [];
  for (const node of rpn) {
    if (node.type === "condition") {
      stack.push(evaluateCondition(item, node.token));
      continue;
    }

    const right = stack.pop();
    const left = stack.pop();
    if (typeof left !== "boolean" || typeof right !== "boolean") {
      throw new Error("filter syntax error: invalid boolean expression");
    }

    if (node.operator === "and") {
      stack.push(left && right);
    } else if (node.operator === "or") {
      stack.push(left || right);
    } else {
      throw new Error(`filter syntax error: unknown logical operator ${node.operator}`);
    }
  }

  if (stack.length !== 1 || typeof stack[0] !== "boolean") {
    throw new Error("filter syntax error: malformed expression");
  }

  return stack[0];
}

function stableSort(items, sort = []) {
  if (!Array.isArray(sort) || sort.length === 0) {
    return items;
  }

  return items
    .map((value, idx) => ({ value, idx }))
    .sort((a, b) => {
      for (const rule of sort) {
        const direction = String(rule.order || "asc").toLowerCase() === "desc" ? -1 : 1;
        const aVal = toComparable(getFieldValue(a.value, rule.field));
        const bVal = toComparable(getFieldValue(b.value, rule.field));

        if (aVal == null && bVal == null) {
          continue;
        }
        if (aVal == null) {
          return 1;
        }
        if (bVal == null) {
          return -1;
        }

        if (aVal < bVal) {
          return -1 * direction;
        }
        if (aVal > bVal) {
          return 1 * direction;
        }
      }

      return a.idx - b.idx;
    })
    .map((entry) => entry.value);
}

export function applyMetaQuery(items, requestQuery = {}) {
  const page = Math.max(0, Number(requestQuery.page ?? 0) || 0);
  const pageSize = Math.min(500, Math.max(1, Number(requestQuery.pageSize ?? 100) || 100));
  const filter = Array.isArray(requestQuery.filter) ? requestQuery.filter : [];
  const sort = Array.isArray(requestQuery.sort) ? requestQuery.sort : [];

  let filtered = items;
  if (filter.length > 0) {
    const rpn = toRpn(filter);
    filtered = items.filter((item) => evaluateRpn(item, rpn));
  }

  const sorted = stableSort([...filtered], sort);
  const total = sorted.length;
  const start = page * pageSize;
  const data = sorted.slice(start, start + pageSize);

  return {
    page,
    pageSize,
    total,
    data
  };
}

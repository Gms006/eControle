import { useMemo } from "react";

export default function useProcessColumnMeta(columns) {
  return useMemo(() => {
    return columns.reduce((acc, column) => {
      acc[column.id] = column;
      return acc;
    }, {});
  }, [columns]);
}

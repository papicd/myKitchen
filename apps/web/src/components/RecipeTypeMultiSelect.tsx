"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RecipeType } from "../lib/types";
import styles from "./RecipeTypeMultiSelect.module.scss";

type Props = {
  id?: string;
  options: RecipeType[];
  selectedIds: string[];
  onChangeAction: (ids: string[]) => void;
  placeholder: string;
  selectedCountLabelAction: (count: number) => string;
  selectAllLabel: string;
  clearLabel: string;
  emptyLabel: string;
};

function getTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized
        .split("")
        .map((char) => `${char}${char}`)
        .join("")
    : normalized;

  const red = Number.parseInt(full.slice(0, 2), 16);
  const green = Number.parseInt(full.slice(2, 4), 16);
  const blue = Number.parseInt(full.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance >= 150 ? "#1f2937" : "#ffffff";
}

export function RecipeTypeMultiSelect({
  id,
  options,
  selectedIds,
  onChangeAction,
  placeholder,
  selectedCountLabelAction,
  selectAllLabel,
  clearLabel,
  emptyLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedTypes = useMemo(
    () => options.filter((option) => selectedSet.has(option.id)),
    [options, selectedSet],
  );

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggleType(id: string) {
    if (selectedSet.has(id)) {
      onChangeAction(selectedIds.filter((value) => value !== id));
      return;
    }

    onChangeAction([...selectedIds, id]);
  }

  const visibleTypes = selectedTypes.slice(0, 3);
  const overflowCount = Math.max(selectedTypes.length - visibleTypes.length, 0);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        id={id}
        type="button"
        className={styles.control}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedTypes.length === 0 ? (
          <span className={styles.placeholder}>{placeholder}</span>
        ) : (
          <span className={styles.pills}>
            {visibleTypes.map((type) => (
              <span
                key={type.id}
                className={styles.pill}
                style={{
                  backgroundColor: type.color,
                  color: getTextColor(type.color),
                }}
              >
                {type.name}
              </span>
            ))}
            {overflowCount > 0 ? <span className={styles.morePill}>+{overflowCount}</span> : null}
          </span>
        )}
        <span className={styles.chevron} aria-hidden="true">v</span>
      </button>

      {open ? (
        <div className={styles.panel}>
          <div className={styles.toolbar}>
            <span className={styles.count}>{selectedCountLabelAction(selectedTypes.length)}</span>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => onChangeAction(options.map((option) => option.id))}
                disabled={options.length === 0 || selectedTypes.length === options.length}
              >
                {selectAllLabel}
              </button>
              <button type="button" onClick={() => onChangeAction([])} disabled={selectedTypes.length === 0}>
                {clearLabel}
              </button>
            </div>
          </div>

          {options.length === 0 ? (
            <p className={styles.empty}>{emptyLabel}</p>
          ) : (
            <ul className={styles.list} role="listbox" aria-multiselectable="true">
              {options.map((type) => {
                const isSelected = selectedSet.has(type.id);
                return (
                  <li key={type.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      className={`${styles.option} ${isSelected ? styles.optionSelected : ""}`}
                      onClick={() => toggleType(type.id)}
                    >
                      <span className={styles.optionMeta}>
                        <span className={styles.swatch} style={{ backgroundColor: type.color }} aria-hidden="true" />
                        <span>{type.name}</span>
                      </span>
                      <span
                        className={`${styles.check} ${isSelected ? styles.checkActive : ""}`}
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}


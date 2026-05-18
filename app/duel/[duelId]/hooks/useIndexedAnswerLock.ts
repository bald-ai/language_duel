import { useCallback, useRef, useState } from "react";

export function useIndexedAnswerLock(getCurrentIndex: () => number | null) {
  const [selectedAnswerRaw, setSelectedAnswerRaw] = useState<string | null>(null);
  const selectedAnswerIndexRef = useRef<number | null>(null);
  const [isLockedRaw, setIsLockedRaw] = useState(false);
  const isLockedIndexRef = useRef<number | null>(null);

  const setSelectedAnswer = useCallback((value: string | null, forIndex?: number) => {
    selectedAnswerIndexRef.current = value === null ? null : (forIndex ?? getCurrentIndex());
    setSelectedAnswerRaw(value);
  }, [getCurrentIndex]);

  const setIsLocked = useCallback((value: boolean) => {
    isLockedIndexRef.current = value ? getCurrentIndex() : null;
    setIsLockedRaw(value);
  }, [getCurrentIndex]);

  const getSelectedAnswerForIndex = useCallback(
    (index: number) => (selectedAnswerIndexRef.current === index ? selectedAnswerRaw : null),
    [selectedAnswerRaw]
  );

  const getIsLockedForIndex = useCallback(
    (index: number) => (isLockedIndexRef.current === index ? isLockedRaw : false),
    [isLockedRaw]
  );

  const getHasAnsweredForIndex = useCallback(
    (index: number, hasAnsweredRaw: boolean) => hasAnsweredRaw && isLockedIndexRef.current === index,
    []
  );

  return {
    isLockedIndexRef,
    selectedAnswerIndexRef,
    setSelectedAnswer,
    setIsLocked,
    getSelectedAnswerForIndex,
    getIsLockedForIndex,
    getHasAnsweredForIndex,
  };
}

import { useEffect, useLayoutEffect, useRef} from 'react';


export function useAutosave(
    value: unknown,
    saveFn: () => void,
    options?: {
        enabled?: boolean;
        delay?: number
    }
) {
    const { enabled = true, delay = 1000 } = options ?? {};
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const saveFnRef = useRef(saveFn);
    const serialized = JSON.stringify(value);

    useLayoutEffect(() => {
        saveFnRef.current = saveFn;
    });

    useEffect(() => {
        if (!enabled) return;
        if (timerRef.current) clearTimeout(timerRef.current);

        timerRef.current = setTimeout(() => {
            saveFnRef.current();
        }, delay);

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, [serialized, enabled, delay]);

}
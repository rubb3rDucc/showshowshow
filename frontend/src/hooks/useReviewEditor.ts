import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JSONContent } from '@tiptap/react';
import { getReview, updateReview } from '../api/reviews';
import { useAutosave } from './useAutosave';
import { useDeleteReview } from './useDeleteReview';

export function useReviewEditor(id: string, navigate: (path: string) => void) {
    const queryClient = useQueryClient();

    const {data: review, isLoading} = useQuery({
        queryKey: ['review', id],
        queryFn: () => getReview(id),
        enabled: !!id,
    });

    const [title, setTitle] = useState<string | null>(null);
    const [bodyJson, setBodyJson] = useState<JSONContent | null>(null);
    const [showModified, setShowModified] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    const displayTitle = title ?? review?.title ?? '';
    const displayBodyJson = bodyJson ?? review?.body ?? null;

    const saveMutation = useMutation({
        mutationFn: ({t, b}: { t: string; b: JSONContent | null }) =>
            updateReview(id, {title: t || undefined, body: b ?? undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
            queryClient.invalidateQueries({ queryKey: ['review', id] });
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 2000);
        },
    });

    useAutosave(
        {title, bodyJson},
        () => saveMutation.mutate({ t: displayTitle, b: displayBodyJson }),
        { enabled: title !== null || bodyJson !== null }
    );

    const saveStatus = saveMutation.isPending ? 'saving' : savedFlash ? 'saved' : 'idle';

    const confirmDelete = useDeleteReview({ onSuccess: () => navigate('/reviews') });
    const handleDelete = () => confirmDelete(id);

    return {
        review,
        isLoading,
        displayTitle,
        displayBodyJson,
        showModified,
        handleDelete,
        saveStatus,
        setTitle,
        setBodyJson,
        setShowModified,
    };
}
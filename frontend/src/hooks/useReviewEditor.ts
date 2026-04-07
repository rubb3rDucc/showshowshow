import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteReview, getReview, updateReview } from '../api/reviews';
import { useAutosave } from './useAutosave';

export function useReviewEditor(id: string, navigate: (path: string) => void) {
    const queryClient = useQueryClient();

    const {data: review, isLoading} = useQuery({
        queryKey: ['review', id],
        queryFn: () => getReview(id),
        enabled: !!id,
    });

    const [title, setTitle] = useState<string | null>(null);
    const [bodyHtml, setBodyHtml] = useState<string | null>(null);
    const [showModified, setShowModified] = useState(false);
    const [savedFlash, setSavedFlash] = useState(false);

    const displayTitle = title ?? review?.title ?? '';
    const displayBodyHtml = bodyHtml ?? review?.body ?? '';

    const saveMutation = useMutation({
        mutationFn: ({t, b}: { t: string; b: string }) =>
            updateReview(id, {title: t || undefined, body: b || undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['reviews'] });
            queryClient.invalidateQueries({ queryKey: ['review', id] });
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 2000);
        },
    });

    useAutosave(
        {title, bodyHtml},
        () => saveMutation.mutate({ t: displayTitle, b: displayBodyHtml }),
        { enabled: title !== null || bodyHtml !== null }
    );

    const saveStatus = saveMutation.isPending ? 'saving' : savedFlash ? 'saved' : 'idle';

    const handleDelete = async () => {
        await deleteReview(id);
        queryClient.invalidateQueries({ queryKey: ['reviews'] });
        navigate('/reviews');
    };

    return {
        review,
        isLoading,
        displayTitle,
        displayBodyHtml,
        showModified,
        handleDelete,
        saveStatus,
        setTitle,
        setBodyHtml,
        setShowModified,
    };
}
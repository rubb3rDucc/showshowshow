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

    const displayTitle = title ?? review?.title ?? '';
    const displayBodyHtml = bodyHtml ?? review?.body ?? '';


    const { mutate: save } = useMutation({
        mutationFn: ({t, b}: { t: string; b: string }) =>
            updateReview(id, {title: t || undefined, body: b || undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['review'] });
            queryClient.invalidateQueries({ queryKey: ['review', id] });
        },
    });

    useAutosave(
        {title, bodyHtml},
        () => save({ t: displayTitle, b: displayBodyHtml }),
        { enabled: title !== null || bodyHtml !== null }   
    );

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
        setTitle,
        setBodyHtml,
        setShowModified,
    };
}
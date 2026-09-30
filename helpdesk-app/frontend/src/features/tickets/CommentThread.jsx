import { useState } from 'react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, Loading } from '../../components/ui/Feedback.jsx';
import { TextArea } from '../../components/ui/Field.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { copy, messageForError } from '../../domain/copy.js';
import { formatDateTime } from '../../domain/labels.js';
import { canComment } from '../../domain/ticketStatus.js';
import { useAddComment, useComments } from './hooks.js';
import styles from './Tickets.module.css';

export function CommentThread({ ticket, user }) {
  const [page, setPage] = useState(1);
  const comments = useComments(ticket.id, page);
  const addComment = useAddComment(ticket.id, page, {
    id: user.id,
    name: user.name,
    role: user.role,
  });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);

  const submit = (event) => {
    event.preventDefault();
    if (!draft.trim()) {
      setError('Write a comment before posting');
      return;
    }
    setError(null);
    const body = draft;
    setDraft('');
    addComment.mutate(body, {
      onError: (err) => {
        setDraft(body); // keep the user's words if posting failed
        setError(messageForError(err));
      },
    });
  };

  return (
    <section aria-labelledby="comments-title">
      <h2 id="comments-title" className={styles.sectionTitle}>
        Comments
        {comments.data ? <span className={styles.muted}> ({comments.data.meta.total})</span> : null}
      </h2>
      {comments.isPending && <Loading label="Loading comments…" />}
      {comments.isError && <ErrorState error={comments.error} onRetry={() => comments.refetch()} />}
      {comments.data &&
        (comments.data.data.length === 0 ? (
          <p className={styles.muted}>No comments yet.</p>
        ) : (
          <ol className={styles.comments}>
            {comments.data.data.map((comment) => (
              <li
                key={comment.id}
                className={styles.comment}
                data-pending={comment.pending || undefined}
              >
                <div className={styles.commentHeader}>
                  <strong>{comment.author.name}</strong>
                  {comment.author.role === 'ADMIN' && (
                    <Badge kind="role" value="ADMIN" prefix="Role" />
                  )}
                  <span className={`${styles.muted} tabular`}>
                    {comment.pending ? (
                      'Posting…'
                    ) : (
                      <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
                    )}
                  </span>
                </div>
                <p className={styles.description}>{comment.body}</p>
              </li>
            ))}
          </ol>
        ))}
      {comments.data && (
        <Pagination
          page={comments.data.meta.page}
          totalPages={comments.data.meta.totalPages}
          onChange={setPage}
          label="Comment pages"
        />
      )}
      {canComment(ticket, user) ? (
        <form className={styles.commentForm} onSubmit={submit} noValidate>
          <TextArea
            label="Add a comment"
            rows={3}
            value={draft}
            maxLength={5000}
            error={error}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            variant="primary"
            loading={addComment.isPending}
            loadingLabel="Posting…"
          >
            Post comment
          </Button>
        </form>
      ) : (
        <p className={styles.muted}>{copy.tickets.commentClosed}</p>
      )}
    </section>
  );
}

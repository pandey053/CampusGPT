import type { AdminAnalytics } from "@/lib/admin-analytics";

export function AdminAnalyticsPanel({
  analytics,
  error,
}: {
  analytics: AdminAnalytics | null;
  error: string | null;
}) {
  return (
    <section aria-labelledby="analytics-title" className="mt-12">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6c8c72]">
          Analytics
        </p>
        <h2
          className="mt-2 text-2xl font-semibold tracking-tight text-[#25382d]"
          id="analytics-title"
        >
          Chat and feedback
        </h2>
        <p className="mt-2 text-sm text-[#68746c]">
          Questions are unanswered when RAG retrieval found no chunks meeting
          the configured similarity threshold. Positivity is positive ratings
          divided by all positive and negative ratings.
        </p>
      </div>

      {error ? (
        <p
          className="mt-5 rounded-xl border border-[#f0d7d2] bg-[#fff7f5] px-4 py-3 text-sm text-[#934d42]"
          role="alert"
        >
          {error}
        </p>
      ) : analytics ? (
        <>
          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="Questions asked" value={analytics.totalQuestions} />
            <MetricCard label="Assistant responses" value={analytics.totalResponses} />
            <MetricCard label="Unanswered questions" value={analytics.unansweredQuestions} />
            <MetricCard label="Positive feedback" value={analytics.positiveFeedback} />
            <MetricCard label="Negative feedback" value={analytics.negativeFeedback} />
            <MetricCard
              label="Feedback positivity"
              value={
                analytics.feedbackPositivityPercentage === null
                  ? "—"
                  : `${analytics.feedbackPositivityPercentage}%`
              }
            />
          </dl>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-[#e3e9e1] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#304338]">
                Feedback ratings
              </h3>
              {analytics.positiveFeedback + analytics.negativeFeedback === 0 ? (
                <p className="mt-4 text-sm text-[#68746c]">
                  No feedback has been submitted yet.
                </p>
              ) : (
                <div className="mt-5 space-y-4">
                  <FeedbackBar
                    label="Positive"
                    value={analytics.positiveFeedback}
                    maximum={Math.max(
                      analytics.positiveFeedback,
                      analytics.negativeFeedback,
                    )}
                    color="bg-[#477963]"
                  />
                  <FeedbackBar
                    label="Negative"
                    value={analytics.negativeFeedback}
                    maximum={Math.max(
                      analytics.positiveFeedback,
                      analytics.negativeFeedback,
                    )}
                    color="bg-[#b5695e]"
                  />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#e3e9e1] bg-white p-5">
              <h3 className="text-sm font-semibold text-[#304338]">
                Most frequently asked
              </h3>
              {analytics.topQuestions.length === 0 ? (
                <p className="mt-4 text-sm text-[#68746c]">
                  No question history is available yet.
                </p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {analytics.topQuestions.map((item, index) => (
                    <li
                      className="flex items-start justify-between gap-4 border-b border-[#edf0eb] pb-3 last:border-0"
                      key={`${item.question}-${index}`}
                    >
                      <span className="min-w-0 break-words text-sm text-[#516157]">
                        {item.question}
                      </span>
                      <span className="shrink-0 rounded-full bg-[#eef4ed] px-2.5 py-1 text-xs font-semibold text-[#477963]">
                        {item.count}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <section className="mt-5 rounded-2xl border border-[#e3e9e1] bg-white p-5">
            <h3 className="text-sm font-semibold text-[#304338]">
              Questions without matching evidence
            </h3>
            {analytics.unansweredQuestionList.length === 0 ? (
              <p className="mt-4 text-sm text-[#68746c]">
                No questions with insufficient retrieval evidence have been
                recorded.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[#edf0eb]">
                {analytics.unansweredQuestionList.map((item, index) => (
                  <li
                    className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                    key={`${item.askedAt}-${index}`}
                  >
                    <span className="break-words text-sm text-[#516157]">
                      {item.question}
                    </span>
                    <time
                      className="shrink-0 text-xs text-[#7b857d]"
                      dateTime={item.askedAt}
                    >
                      {new Date(item.askedAt).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p className="mt-3 text-xs text-[#7b857d]">
            Questions saved before evidence tracking was enabled are excluded
            from unanswered counts. Legacy numeric feedback without a sentiment
            label is excluded from positivity calculations.
          </p>
        </>
      ) : (
        <p className="mt-5 text-sm text-[#68746c]" role="status">
          Analytics could not be displayed.
        </p>
      )}
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[#e3e9e1] bg-white p-4">
      <dt className="text-xs font-medium text-[#68746c]">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold tracking-tight text-[#25382d]">
        {value}
      </dd>
    </div>
  );
}

function FeedbackBar({
  label,
  value,
  maximum,
  color,
}: {
  label: string;
  value: number;
  maximum: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs text-[#68746c]">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div
        aria-label={`${label} feedback: ${value}`}
        className="h-2.5 overflow-hidden rounded-full bg-[#edf0eb]"
        role="img"
      >
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${maximum > 0 ? (value / maximum) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

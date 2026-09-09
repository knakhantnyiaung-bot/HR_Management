import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api/client";
import { completeCourse, enrollInCourse, listCourses, listEnrollments } from "@/features/courses/api";

// LMS-03..05 — browse the ACTIVE catalog, self-enroll, self-report
// completion. Cross-references the caller's own enrollments (the backend
// already scopes listEnrollments to "mine" for a non-HR requester) against
// the catalog to know each course's state without a per-course lookup.
export function CourseCatalog() {
  const queryClient = useQueryClient();

  const { data: courses, isLoading, isError, error } = useQuery({
    queryKey: ["courses", "catalog"],
    queryFn: () => listCourses({ page: 1, pageSize: 100, status: "ACTIVE" }),
  });

  const { data: myEnrollments } = useQuery({
    queryKey: ["courses", "enrollments", "mine"],
    queryFn: () => listEnrollments({ page: 1, pageSize: 100 }),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["courses"] });
  }

  const enrollMutation = useMutation({ mutationFn: enrollInCourse, onSuccess: invalidate });
  const completeMutation = useMutation({ mutationFn: completeCourse, onSuccess: invalidate });
  const actionError = enrollMutation.error ?? completeMutation.error;

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Course catalog</h2>

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && <p className="mt-2 error-text">{getApiErrorMessage(error, "Could not load courses.")}</p>}
      {actionError && (
        <p className="mt-2 error-text">{getApiErrorMessage(actionError, "That action failed.")}</p>
      )}

      {courses && (
        <ul className="mt-2 divide-y divide-slate-100 card dark:divide-slate-800">
          {courses.items.length === 0 && (
            <li className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
              No courses available yet.
            </li>
          )}
          {courses.items.map((course) => {
            const enrollment = myEnrollments?.items.find((e) => e.courseId === course.id);
            return (
              <li key={course.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <a
                      href={course.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      {course.title}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                    {course.mandatory && (
                      <span className="rounded-full bg-danger-50 px-2 py-0.5 text-xs font-medium text-danger-600 dark:bg-danger-500/10 dark:text-danger-400">
                        Mandatory
                      </span>
                    )}
                  </div>
                  {course.description && (
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{course.description}</p>
                  )}
                  {course.category && (
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{course.category}</p>
                  )}
                </div>

                <div className="shrink-0">
                  {!enrollment && (
                    <button
                      type="button"
                      onClick={() => enrollMutation.mutate(course.id)}
                      disabled={enrollMutation.isPending}
                      className="btn-primary"
                    >
                      Enroll
                    </button>
                  )}
                  {enrollment && !enrollment.completedAt && (
                    <button
                      type="button"
                      onClick={() => completeMutation.mutate(course.id)}
                      disabled={completeMutation.isPending}
                      className="btn-text"
                    >
                      Mark complete
                    </button>
                  )}
                  {enrollment?.completedAt && (
                    <span className="text-sm font-medium text-success-700 dark:text-success-400">
                      Completed
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

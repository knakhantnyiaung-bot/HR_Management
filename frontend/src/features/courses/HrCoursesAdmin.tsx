import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TextField } from "@/components/form/TextField";
import { StatusBadge } from "@/components/StatusBadge";
import { getApiErrorMessage } from "@/lib/api/client";
import { createCourse, enrollAllActiveEmployees, listCourses, updateCourse } from "@/features/courses/api";

const courseSchema = z.object({
  title: z.string().min(1, "Required"),
  description: z.string().optional(),
  externalUrl: z.string().url("Must be a valid URL"),
  category: z.string().optional(),
  mandatory: z.boolean(),
});
type CourseForm = z.infer<typeof courseSchema>;

export function HrCoursesAdmin() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [bulkEnrolledCourseId, setBulkEnrolledCourseId] = useState<string | null>(null);

  const { data: courses, isLoading, isError, error } = useQuery({
    queryKey: ["courses", "all"],
    queryFn: () => listCourses({ page: 1, pageSize: 100 }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CourseForm>({ resolver: zodResolver(courseSchema), defaultValues: { mandatory: false } });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["courses"] });
  }

  const createMutation = useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      invalidate();
      reset();
      setShowForm(false);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => updateCourse(id, { status: "ARCHIVED" }),
    onSuccess: invalidate,
  });

  const bulkEnrollMutation = useMutation({
    mutationFn: enrollAllActiveEmployees,
    onSuccess: (result, id) => {
      invalidate();
      setBulkEnrolledCourseId(`${id}:${result.newlyEnrolled}`);
    },
  });

  const actionError = createMutation.error ?? archiveMutation.error ?? bulkEnrollMutation.error;

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Manage courses</h2>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
            New course
          </button>
        )}
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="mt-2 space-y-4 card"
        >
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Title" registration={register("title")} error={errors.title?.message} />
            <TextField
              label="External URL"
              registration={register("externalUrl")}
              error={errors.externalUrl?.message}
            />
            <TextField
              label="Category (optional)"
              registration={register("category")}
              error={errors.category?.message}
            />
            <TextField
              label="Description (optional)"
              registration={register("description")}
              error={errors.description?.message}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register("mandatory")}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-700"
            />
            Mandatory
          </label>
          {createMutation.isError && (
            <p className="error-text">{getApiErrorMessage(createMutation.error, "Could not create the course.")}</p>
          )}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={createMutation.isPending} className="btn-primary">
              {createMutation.isPending ? "Adding…" : "Add course"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-text">
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Loading…</p>}
      {isError && <p className="mt-2 error-text">{getApiErrorMessage(error, "Could not load courses.")}</p>}
      {actionError && (
        <p className="mt-2 error-text">{getApiErrorMessage(actionError, "That action failed.")}</p>
      )}

      {courses && (
        <div className="mt-4 overflow-hidden card-table">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="table-head-cell">Title</th>
                <th className="table-head-cell">Category</th>
                <th className="table-head-cell">Mandatory</th>
                <th className="table-head-cell">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {courses.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
                    No courses yet.
                  </td>
                </tr>
              )}
              {courses.items.map((course) => (
                <tr key={course.id} className="row-hover">
                  <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{course.title}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{course.category ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {course.mandatory ? "Yes" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={course.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {course.status === "ACTIVE" && (
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => bulkEnrollMutation.mutate(course.id)}
                          disabled={bulkEnrollMutation.isPending}
                          className="btn-text"
                        >
                          Enroll all active
                        </button>
                        <button
                          type="button"
                          onClick={() => archiveMutation.mutate(course.id)}
                          disabled={archiveMutation.isPending}
                          className="btn-text text-danger-600 hover:underline dark:text-danger-400"
                        >
                          Archive
                        </button>
                      </div>
                    )}
                    {bulkEnrolledCourseId?.startsWith(`${course.id}:`) && (
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        {bulkEnrolledCourseId.split(":")[1]} newly enrolled
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

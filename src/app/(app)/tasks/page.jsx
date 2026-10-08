"use client";
import { PageHeader } from "@/components/layout/page-header";
import { TasksPanel } from "@/components/tasks/tasks-panel";
export default function TasksPage() {
    return (<>
      <PageHeader title="Tasks" description="Search and filter tasks across all of your projects."/>
      <TasksPanel />
    </>);
}

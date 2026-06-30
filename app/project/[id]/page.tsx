import ProjectDetailClient from "../project-detail-client";
import "../project-detail.css";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetailClient id={id} />;
}

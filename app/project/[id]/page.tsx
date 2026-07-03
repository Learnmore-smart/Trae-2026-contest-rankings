import ProjectDetailClient from "../project-detail-client";
import "../project-detail.css";
import { normalizeTopicRouteId } from "@/lib/trae/topic-route-id";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetailClient id={normalizeTopicRouteId(id)} />;
}

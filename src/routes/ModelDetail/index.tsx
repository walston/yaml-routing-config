import { useParams } from 'react-router-dom';

export default function ModelDetailPage() {
  const { modelId } = useParams();
  return (
    <div className="page">
      <div className="page-badge system">Platform — Child Route</div>
      <h1>Model Detail</h1>
      <p>
        <code>/models/:modelId</code> — child of <code>/models</code>,
        inferred from path prefix. No nav entry.
      </p>
      <p style={{ marginTop: 12 }}>
        modelId: <code>{modelId}</code>
      </p>
    </div>
  );
}

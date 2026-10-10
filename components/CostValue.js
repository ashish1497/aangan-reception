import { Card, Descriptions } from 'antd';
import { inr, lakh } from '../lib/dashboardData';
import Section from './Section';

export default function CostValue({ stats }) {
  const c = stats.cost;
  const v = stats.value;
  const items = [
    {
      key: 'min',
      label: 'Voice minutes',
      children: `${c.totalVoiceMinutes} min at ${inr(c.voiceCostPerMin)}/min`,
    },
    { key: 'llm', label: 'LLM per call', children: inr(c.llmCostPerCall) },
    { key: 'total', label: 'Total cost', children: <span data-testid="cost-total">{inr(c.totalInr)}</span> },
    {
      key: 'per',
      label: 'Cost per call',
      children: <span data-testid="cost-per-call">{inr(c.perCallInr)}</span>,
    },
    {
      key: 'q',
      label: 'Qualified leads',
      children: <span data-testid="value-qualified">{v.qualifiedLeads}</span>,
    },
    {
      key: 'pipe',
      label: 'Pipeline value if converted',
      children: (
        <span data-testid="value-pipeline">
          {lakh(v.pipelineLowInr)} to {lakh(v.pipelineHighInr)}
        </span>
      ),
    },
  ];
  return (
    <Section
      id="cost"
      title="Cost and value"
      note="What the desk costs to run and what the qualified enquiries could be worth."
      data-testid="cost-value"
    >
      <Card className="flat-card" bordered={false}>
        <Descriptions className="kv" column={1} size="small" items={items} />
      </Card>
      <p className="note">
        Pipeline value is what the qualified enquiries are worth if every one of them converts, at Rs 8 to 14
        lakh a project. Conversion is tracked as projects close.
      </p>
    </Section>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { Executive } from '@/types/evaluation';
import { getScoreColor } from '@/lib/scoring';
import { User, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Props {
  executives: Executive[];
}

interface TreeNode {
  exec: Executive;
  children: TreeNode[];
}

function buildTree(executives: Executive[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const exec of executives) {
    map.set(exec.id, { exec, children: [] });
  }

  for (const exec of executives) {
    const node = map.get(exec.id)!;
    if (exec.reportsTo && map.has(exec.reportsTo)) {
      map.get(exec.reportsTo)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

const OrgNode = ({ node, depth = 0 }: { node: TreeNode; depth?: number }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div className="space-y-1">
      <div
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
        onClick={() => setExpanded(!expanded)}
      >
        {hasChildren && (
          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
        )}
        {!hasChildren && <div className="w-3.5" />}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{node.exec.name}</p>
          <p className="text-xs text-muted-foreground truncate">{node.exec.title}</p>
        </div>
        <span className={`text-sm font-mono font-semibold ${getScoreColor(node.exec.compositeScore)}`}>
          {node.exec.compositeScore}
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <OrgNode key={child.exec.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const OrgChart = ({ executives }: Props) => {
  const tree = buildTree(executives);

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="font-semibold text-sm mb-3">Organization Structure</h3>
        <div className="space-y-0.5">
          {tree.map(root => (
            <OrgNode key={root.exec.id} node={root} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BoardMember } from '@/types/evaluation';
import { Users } from 'lucide-react';

interface Props {
  boardMembers: BoardMember[];
}

export const BoardComposition = ({ boardMembers }: Props) => {
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">Board of Directors ({boardMembers.length} members)</h3>
          <div className="space-y-3">
            {boardMembers.map(member => (
              <div key={member.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.title} · {member.tenure}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{member.background}</p>
                {member.otherBoards.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {member.otherBoards.map((board, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{board}</Badge>
                    ))}
                  </div>
                )}
                {member.crossRelationships.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs text-primary">
                    <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{member.crossRelationships.join('; ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

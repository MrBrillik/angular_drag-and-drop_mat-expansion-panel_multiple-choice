import { Component, Input, computed, signal, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Project } from './project.interface';
import { DragDropService } from './drag-drop.service';

@Component({
  selector: 'app-project-node',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="custom-project-panel">
      
      <div 
        class="panel-header"
        [class.selected]="isSelected()"
        (mousedown)="onHeaderMouseDown($event)"
        [attr.data-project-id]="project.id"
      >
        <span 
          class="expand-arrow" 
          [class.arrow-rotated]="expanded()"
          *ngIf="children().length > 0"
        >▶</span>
        
        <span class="project-name">{{ project.name }}</span>
      </div>

      <div 
        class="children-container" 
        [class.drop-zone]="expanded() || children().length === 0"
        [class.content-hidden]="!expanded()"
        [attr.data-drop-zone-id]="project.id"
      >
        <ng-container *ngIf="expanded()">
          @for (child of children(); track child.id) {
            <app-project-node
              [project]="child"
              [projectMapSignal]="projectMapSignal"
            />
          }
        </ng-container>
      </div>

    </div>
  `,
  styles: [`
    .custom-project-panel {
      margin: 4px 0;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      background: #ffffff;
      overflow: hidden;
      display: block;
    }
    
    .panel-header { 
      position: relative; 
      user-select: none; 
      -webkit-user-select: none;
      display: flex;
      align-items: center;
      height: 48px; 
      padding: 0 16px;
      cursor: grab !important;
      transition: background-color 0.2s ease;
    }
    .panel-header:active { cursor: grabbing !important; }
    .panel-header.selected { background: #b3e5fc !important; }
    
    .expand-arrow {
      margin-right: 8px;
      font-size: 11px;
      color: #757575;
      transition: transform 0.2s ease;
      display: inline-block;
    }
    .arrow-rotated {
      transform: rotate(90deg);
    }
    .project-name {
      font-size: 14px;
      color: #333333;
    }
    
    .children-container { 
      padding-left: 20px; 
      transition: background-color 0.15s, height 0.2s; 
    }
    
    .content-hidden {
      display: none;
    }
    
    .children-container.drop-inside {
      display: block !important;
      background-color: rgba(76, 175, 80, 0.15) !important; 
      border: 1px dashed #4caf50;
      min-height: 24px;
      margin: 4px 4px 4px 20px;
    }

    .panel-header.drop-before::before {
      content: ""; position: absolute; left: 0; right: 0; top: 0; height: 4px; background: #4caf50; z-index: 10;
    }
    .panel-header.drop-after::after {
      content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: #4caf50; z-index: 10;
    }
    .panel-header.drop-inside {
      background-color: rgba(76, 175, 80, 0.2) !important;
      border: 1px dashed #4caf50;
    }
    .panel-header.drop-denied, .children-container.drop-denied {
      background-color: rgba(244, 67, 54, 0.15) !important;
    }
  `]
})
export class ProjectNodeComponent {
  @Input({ required: true }) project!: Project;
  @Input({ required: true }) projectMapSignal!: Signal<Record<string, Project[]>>;

  expanded = signal(false);

  children = computed(() => this.projectMapSignal()[this.project.id] ?? []);
  isSelected = computed(() => this.dragDrop.selectedIds().has(this.project.id));

  constructor(private dragDrop: DragDropService) { }

  onHeaderMouseDown(event: MouseEvent) {
    if (event.button !== 0) return;

    const ctrl = event.ctrlKey || event.metaKey;

    // ИСПРАВЛЕНИЕ: Если зажат Ctrl, передаем пустую заглушку () => {}.
    // Панель останется на месте. Если Ctrl не зажат — передаем рабочий переключатель.
    const toggleExpandFn = ctrl
      ? () => { }
      : () => this.expanded.set(!this.expanded());

    this.dragDrop.onHeaderMouseDown(event, this.project.id, toggleExpandFn);
  }
}

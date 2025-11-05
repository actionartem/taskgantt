"use client"

import { useState, type FormEvent } from "react"
import { Check, Plus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { Board } from "@/lib/types"

interface BoardSelectorProps {
  boards: Board[]
  currentBoardId: string | null
  onSelect: (boardId: string) => void
  onCreate: (name: string) => Board
}

export function BoardSelector({ boards, currentBoardId, onSelect, onCreate }: BoardSelectorProps) {
  const [open, setOpen] = useState(false)
  const [isAddingBoard, setIsAddingBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState("")

  const handleSelectBoard = (boardId: string) => {
    onSelect(boardId)
    setOpen(false)
  }

  const resetState = () => {
    setIsAddingBoard(false)
    setNewBoardName("")
  }

  const handleOpenChange = (value: boolean) => {
    setOpen(value)
    if (!value) {
      resetState()
    }
  }

  const handleAddBoard = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = newBoardName.trim()
    if (!trimmedName) {
      return
    }

    onCreate(trimmedName)
    setOpen(false)
    resetState()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Выбрать доску</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Доски</DialogTitle>
          <DialogDescription>
            Выберите существующую доску или создайте новую для организации задач.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ScrollArea className="max-h-60 pr-2">
            <div className="space-y-2">
              {boards.length === 0 ? (
                <p className="text-sm text-muted-foreground">Доски еще не созданы.</p>
              ) : (
                boards.map((board) => (
                  <Button
                    key={board.id}
                    type="button"
                    variant={board.id === currentBoardId ? "default" : "outline"}
                    className={cn(
                      "w-full justify-between",
                      board.id !== currentBoardId && "bg-muted/40 hover:bg-muted"
                    )}
                    onClick={() => handleSelectBoard(board.id)}
                  >
                    <span className="truncate text-left">{board.name}</span>
                    {board.id === currentBoardId ? <Check className="h-4 w-4" /> : null}
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>

          {isAddingBoard ? (
            <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={handleAddBoard}>
              <Input
                value={newBoardName}
                onChange={(event) => setNewBoardName(event.target.value)}
                placeholder="Название доски"
                autoFocus
              />
              <div className="flex gap-2 sm:justify-end">
                <Button type="submit" disabled={!newBoardName.trim()}>
                  Сохранить
                </Button>
                <Button type="button" variant="outline" onClick={resetState}>
                  <X className="mr-1 h-4 w-4" />
                  Отмена
                </Button>
              </div>
            </form>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-center"
              onClick={() => setIsAddingBoard(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Добавить доску
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
